"""
Code Sandbox — hardened, network-isolated subprocess execution.

Final-round hardening (no Docker dependency):
  - cwd jail          : runs inside a fresh temp directory, never backend/sandbox
  - dropped env       : minimal environment (no inherited secrets / API keys)
  - network block     : a sitecustomize shim prepended via PYTHONPATH patches
                        socket.connect / connect_ex / create_connection to
                        raise OSError on any non-loopback egress, and records
                        the interception to a flag file the parent reads
  - resource caps     : RLIMIT_CPU + RLIMIT_AS on POSIX (Windows falls back to
                        the 10s subprocess timeout, documented)
  - artifact capture   : the executed code is saved under outputs/ as a
                        downloadable, hashable .py artifact

The public interface (run_code_sandbox -> dict) is unchanged so the
orchestrator and verifier keep working.
"""

from __future__ import annotations

import datetime
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

from app.sovereignty.inspector import record_blocked_attempt

_OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "outputs"
_OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

_TIMEOUT_SECONDS = 10
_CPU_SECONDS = 10
_MEMORY_MB = 512

# sitecustomize shim injected via PYTHONPATH — runs before user code.
_NETBLOCK_SHIM = '''import socket, os
_orig_connect = socket.socket.connect
_orig_connect_ex = socket.socket.connect_ex
_orig_create = socket.create_connection
_FLAG = os.environ.get("ANTARAI_NETBLOCK_FLAG", "")
def _flag():
    if _FLAG:
        try:
            open(_FLAG, "w").write("1")
        except Exception:
            pass
def _connect(self, addr, *a, **k):
    host = addr[0] if isinstance(addr, (tuple, list)) else str(addr)
    if host in ("127.0.0.1", "::1", "localhost"):
        return _orig_connect(self, addr, *a, **k)
    _flag()
    raise OSError("network egress blocked by AntarAI sandbox policy")
def _connect_ex(self, addr, *a, **k):
    host = addr[0] if isinstance(addr, (tuple, list)) else str(addr)
    if host in ("127.0.0.1", "::1", "localhost"):
        return _orig_connect_ex(self, addr, *a, **k)
    _flag()
    raise OSError("network egress blocked by AntarAI sandbox policy")
def _create_connection(addr, *a, **k):
    host = addr[0] if isinstance(addr, (tuple, list)) else str(addr)
    if host in ("127.0.0.1", "::1", "localhost"):
        return _orig_create(addr, *a, **k)
    _flag()
    raise OSError("network egress blocked by AntarAI sandbox policy")
socket.socket.connect = _connect
socket.socket.connect_ex = _connect_ex
socket.create_connection = _create_connection
'''


_FENCED_CODE_BLOCK = re.compile(
    r"(?ms)^[ \t]*(?P<fence>`{3,}|~{3,})[ \t]*(?P<language>[A-Za-z0-9_+-]*)[ \t]*\r?\n"
    r"(?P<code>.*?)(?:^[ \t]*(?P=fence)[ \t]*$)"
)


def _extract_code_block(text: str) -> str:
    """Extract a complete, explicitly delimited Python code block.

    A generated response may contain an explanation before or after the code.
    The sandbox must never mistake that prose (or an unclosed fence) for source.
    Raw input remains supported for users who provide a Python script directly.
    """
    matches = list(_FENCED_CODE_BLOCK.finditer(text))
    if matches:
        for match in matches:
            language = match.group("language").lower()
            if language in {"", "python", "py"}:
                return match.group("code").strip()
        languages = ", ".join(sorted({match.group("language") or "plain text" for match in matches}))
        raise ValueError(f"Python Sandbox received unsupported fenced language: {languages}")

    if re.search(r"(?m)^[ \t]*(`{3,}|~{3,})", text):
        raise ValueError("Code block is not closed. Start with ```python and end with ``` on its own line.")
    return text.strip()


def run_code_sandbox(code_or_response: str, persist_artifact: bool = True) -> dict:
    """Execute Python code in a hardened, network-isolated subprocess.

    Returns dict: status, stdout, stderr, exit_code, code, network_blocked,
    egress_attempted, code_file, duration_ms.
    """
    try:
        code = _extract_code_block(code_or_response)
        compile(code, "solution.py", "exec")
    except (SyntaxError, ValueError) as exc:
        detail = f"Code validation failed before sandbox execution: {exc}"
        return {
            "status": "failed",
            "stdout": "",
            "stderr": detail,
            "exit_code": 1,
            "code": "",
            "network_blocked": True,
            "egress_attempted": False,
            "code_file": None,
            "duration_ms": 0,
        }

    # Persist exactly the source that will be executed. Verification can opt
    # out so it re-runs the already-delivered artifact without creating a
    # second, similarly named file.
    artifact_name: Optional[str] = None
    if persist_artifact:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        artifact_name = f"solution_{timestamp}.py"
        artifact_path = _OUTPUTS_DIR / artifact_name
        artifact_path.write_text(code, encoding="utf-8")

    # Fresh temp jail for execution.
    jail = Path(tempfile.mkdtemp(prefix="antarai_jail_"))
    (jail / "sitecustomize.py").write_text(_NETBLOCK_SHIM, encoding="utf-8")
    solution_file = jail / "solution.py"
    solution_file.write_text(code, encoding="utf-8")
    flag_file = jail / "_netblock.flag"
    flag_path = str(flag_file)

    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": str(jail),
        "PYTHONDONTWRITEBYTECODE": "1",
        "ANTARAI_NETBLOCK_FLAG": flag_path,
        "TEMP": os.environ.get("TEMP", ""),
        "TMP": os.environ.get("TMP", ""),
    }
    if sys.platform.startswith("win"):
        # Windows needs SYSTEMROOT for various stdlib calls.
        env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", r"C:\Windows")

    preexec = _posix_limits() if not sys.platform.startswith("win") else None

    start = time.monotonic()
    try:
        result = subprocess.run(
            [sys.executable, str(solution_file)],
            capture_output=True,
            text=True,
            timeout=_TIMEOUT_SECONDS,
            cwd=str(jail),
            env=env,
            preexec_fn=preexec,
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        egress_attempted = flag_file.exists()
        if egress_attempted:
            record_blocked_attempt()
        return {
            "status": "passed" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "code": code,
            "network_blocked": True,
            "egress_attempted": egress_attempted,
            "code_file": artifact_name,
            "duration_ms": duration_ms,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "timeout",
            "stdout": "",
            "stderr": f"Execution exceeded {_TIMEOUT_SECONDS}s time limit.",
            "exit_code": -1,
            "code": code,
            "network_blocked": True,
            "egress_attempted": flag_file.exists(),
            "code_file": artifact_name,
            "duration_ms": _TIMEOUT_SECONDS * 1000,
        }
    except Exception as exc:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(exc),
            "exit_code": -1,
            "code": code,
            "network_blocked": True,
            "egress_attempted": flag_file.exists(),
            "code_file": artifact_name,
            "duration_ms": int((time.monotonic() - start) * 1000),
        }


def _posix_limits():  # pragma: no cover - POSIX-only
    import resource

    def _set() -> None:
        # CPU seconds + address-space cap to bound runaway code.
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (_CPU_SECONDS, _CPU_SECONDS))
        except Exception:
            pass
        try:
            mem_bytes = _MEMORY_MB * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except Exception:
            pass

    return _set
