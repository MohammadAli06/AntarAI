"""
Code Sandbox — real subprocess execution.

Writes generated code to sandbox/solution.py, runs it with Python via
subprocess with a 10-second timeout, and captures stdout/stderr.

For the final round: replace subprocess with Docker --network=none for
true isolation.  The interface (run_code_sandbox → dict) stays identical.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
import re

# Sandbox directory lives next to backend/
_SANDBOX_DIR = Path(__file__).resolve().parents[2] / "sandbox"
_SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
_SOLUTION_FILE = _SANDBOX_DIR / "solution.py"

_TIMEOUT_SECONDS = 10


def _extract_code_block(text: str) -> str:
    """
    Pull the first ```python ... ``` block out of a model response.
    If no fence found, treat the whole text as code.
    """
    pattern = r"```(?:python)?\s*\n(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


def run_code_sandbox(code_or_response: str) -> dict:
    """
    Execute Python code in a sandboxed subprocess.

    Parameters
    ----------
    code_or_response : str
        Raw model response.  May contain markdown code fences — they are
        stripped automatically before execution.

    Returns
    -------
    dict
        Keys: status ("passed" | "failed" | "timeout"),
              stdout, stderr, exit_code.
    """
    code = _extract_code_block(code_or_response)

    # Write to sandbox file
    _SOLUTION_FILE.write_text(code, encoding="utf-8")

    try:
        result = subprocess.run(
            [sys.executable, str(_SOLUTION_FILE)],
            capture_output=True,
            text=True,
            timeout=_TIMEOUT_SECONDS,
        )
        return {
            "status": "passed" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "code": code,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "timeout",
            "stdout": "",
            "stderr": f"Execution exceeded {_TIMEOUT_SECONDS}s time limit.",
            "exit_code": -1,
            "code": code,
        }
    except Exception as exc:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(exc),
            "exit_code": -1,
            "code": code,
        }
