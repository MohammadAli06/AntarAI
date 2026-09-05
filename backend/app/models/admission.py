"""
Model Admission Pipeline — sovereign model provisioning for AntarAI.

Every open-weight model entering the organisation passes through a
gate-controlled pipeline:

    source → integrity → metadata → hardware fit → policy → node → port
    → registration → health check → audit record.

The pipeline NEVER downloads anything. Catalog entries describe models the
organisation has pre-approved; the GGUF itself must already be present under
backend/models (offline package / internal repository / USB import). That
keeps the air-gapped guarantee intact — admission is about safe onboarding,
not network access.
"""

from __future__ import annotations

import hashlib
import logging
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

import yaml

from app.models.gguf_inspector import inspect_gguf
from app.models import registry as model_registry
from app.models.schemas import ModelEntry
from app.system_log import log_event

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_CATALOG_PATH = _BACKEND_ROOT / "catalog.yaml"
_MODEL_DIR = _BACKEND_ROOT / "models"
_POLICIES_PATH = _BACKEND_ROOT / "policies.yaml"

_PORT_RANGE = range(8080, 8096)
_RESERVED_PORTS = {8000, 8081}  # FastAPI + the existing llama.cpp server

_ROLES = ("general", "coder", "vision")


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def _load_catalog() -> dict[str, dict]:
    if not _CATALOG_PATH.exists():
        return {}
    with open(_CATALOG_PATH, "r", encoding="utf-8") as file:
        data = yaml.safe_load(file) or {}
    models = data.get("models", data)
    return {key: entry for key, entry in models.items()} if isinstance(models, dict) else {}


def _load_policies() -> dict:
    if not _POLICIES_PATH.exists():
        return {}
    with open(_POLICIES_PATH, "r", encoding="utf-8") as file:
        return yaml.safe_load(file) or {}


def catalog_entries() -> list[dict]:
    """Catalog entries enriched with local availability on this node."""
    result: list[dict] = []
    for key, entry in _load_catalog().items():
        path = _MODEL_DIR / entry.get("model_path", "")
        result.append({
            **entry,
            "key": key,
            "installed": path.is_file(),
            "file_exists": path.is_file(),
        })
    return result


# ---------------------------------------------------------------------------
# Hardware / node / port primitives
# ---------------------------------------------------------------------------

def _detect_gpu() -> dict:
    try:
        import pynvml  # type: ignore
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode("utf-8", errors="replace")
        info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        total_gb = round(info.total / (1024 ** 3), 1)
        used_gb = round(info.used / (1024 ** 3), 1)
        utilization = round((used_gb / total_gb) * 100) if total_gb else 0
        pynvml.nvmlShutdown()
        return {"name": name, "total_vram_gb": total_gb, "used_vram_gb": used_gb, "utilization_pct": utilization}
    except Exception:
        return {"name": None, "total_vram_gb": None, "used_vram_gb": None, "utilization_pct": None}


def _nodes() -> list[dict]:
    """Deployment targets known to this installation."""
    gpu = _detect_gpu()
    nodes: list[dict] = []
    if gpu["name"]:
        nodes.append({
            "name": "GPU-NODE-01",
            "gpu": gpu["name"],
            "vram_gb": gpu["total_vram_gb"],
            "used_vram_gb": gpu["used_vram_gb"],
            "utilization_pct": gpu["utilization_pct"],
            "runtime": "llama.cpp",
        })
    nodes.append({"name": "CPU-NODE-01", "gpu": None, "vram_gb": None, "utilization_pct": None, "runtime": "llama.cpp"})
    return nodes


def _allocate_port() -> int:
    for port in _PORT_RANGE:
        if port in _RESERVED_PORTS:
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.15)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No free local port available in 8080-8095")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


# ---------------------------------------------------------------------------
# Admission checks (used by both the pre-check endpoint and the pipeline)
# ---------------------------------------------------------------------------

def resolve_source(source: str, catalog_key: Optional[str], model_path: str) -> Path:
    """Resolve the physical GGUF for an admission request."""
    if source == "catalog":
        if not catalog_key:
            raise ValueError("Catalog admission requires a catalog key")
        entry = _load_catalog().get(catalog_key)
        if not entry:
            raise ValueError(f"Unknown catalog model: {catalog_key}")
        resolved = _MODEL_DIR / entry.get("model_path", "")
    elif source in {"local", "offline-package"}:
        supplied = Path(model_path or "")
        resolved = supplied.resolve() if supplied.is_absolute() else (_MODEL_DIR / supplied).resolve()
        root = _MODEL_DIR.resolve()
        if root != resolved and root not in resolved.parents:
            raise ValueError("Model files must be placed under backend/models")
    else:
        raise ValueError(f"Unknown admission source: {source}")
    if not resolved.is_file():
        raise FileNotFoundError(
            f"Offline model package not found: {resolved.name}. "
            f"Place the GGUF under backend/models (internal repository / USB import)."
        )
    return resolved


def run_checks(path: Path, metadata: dict, role: str) -> list[dict]:
    """Hardware-fit + policy checks against an inspected GGUF."""
    policies = _load_policies()
    admission_policy = policies.get("model_admission", {})
    allowed_quants = {q.upper() for q in admission_policy.get("allowed_quantizations", [])}
    allowed_archs = {a.lower() for a in admission_policy.get("allowed_architectures", [])}
    max_size_gb = admission_policy.get("max_file_size_gb", 12)

    quant = str(metadata.get("quantization") or "").upper()
    arch = str(metadata.get("architecture") or "").lower()
    size_gb = round(metadata.get("file_size_bytes", 0) / (1024 ** 3), 2)
    est_vram = metadata.get("estimated_vram_gb", 0.0)
    gpu = _detect_gpu()
    checks: list[dict] = []

    checks.append({
        "id": "format",
        "label": "GGUF format",
        "status": "passed" if metadata.get("format") == "GGUF" else "failed",
        "detail": f"GGUF v{metadata.get('gguf_version', '?')} · {metadata.get('tensor_count', 0):,} tensors",
    })
    checks.append({
        "id": "architecture",
        "label": "Architecture supported",
        "status": "passed" if arch in allowed_archs else "failed",
        "detail": f"{arch} · llama.cpp compatible: {arch in allowed_archs}",
    })
    checks.append({
        "id": "quantization",
        "label": "Quantization supported",
        "status": "passed" if quant in allowed_quants else "failed",
        "detail": f"{quant or 'unknown'}",
    })
    checks.append({
        "id": "size",
        "label": "Model size within policy",
        "status": "passed" if size_gb <= max_size_gb else "failed",
        "detail": f"{size_gb} GB (policy max {max_size_gb} GB)",
    })
    if gpu["name"]:
        fits = est_vram <= float(gpu["total_vram_gb"] or 0)
        headroom = round(float(gpu["total_vram_gb"] or 0) - est_vram, 1)
        checks.append({
            "id": "vram",
            "label": "VRAM sufficient",
            "status": "passed" if fits else "failed",
            "detail": f"Detected {gpu['total_vram_gb']} GB ({gpu['name']}) · model needs ~{est_vram} GB · headroom {headroom} GB",
        })
    else:
        checks.append({
            "id": "vram",
            "label": "VRAM sufficient",
            "status": "passed",
            "detail": "No GPU detected — CPU inference mode (slower but functional)",
        })
    checks.append({
        "id": "role",
        "label": "Capability slot valid",
        "status": "passed" if role in _ROLES else "failed",
        "detail": f"Assigned capability: {role.upper()}",
    })
    return checks


# ---------------------------------------------------------------------------
# The admission pipeline (streaming)
# ---------------------------------------------------------------------------

def _step(type_: str, step: str, status: str, detail: str = "", **extra: Any) -> dict:
    return {"type": type_, "step": step, "status": status, "detail": detail, **extra}


def admit_model_stream(
    *,
    source: str,
    role: str,
    catalog_key: Optional[str] = None,
    model_path: str = "",
    description: str = "",
    capabilities: Optional[list[str]] = None,
    runtime_context_tokens: int = 4096,
    admitted_by: str = "admin",
    persist_audit=None,
) -> Iterator[dict]:
    """Run the full admission pipeline, yielding progress events.

    persist_audit — optional callable(summary: dict) -> int called on success
    (injected by the endpoint so the DB record is written with a live session).
    """
    if role not in _ROLES:
        yield _step("admission.failed", "policy", "failed", f"Invalid capability slot: {role}")
        return

    catalog_entry = _load_catalog().get(catalog_key or "", {}) if source == "catalog" else {}

    # 1. Source
    yield _step("admission.step", "source", "running", "Resolving model package…")
    try:
        path = resolve_source(source, catalog_key, model_path)
    except (ValueError, FileNotFoundError) as exc:
        yield _step("admission.step", "source", "failed", str(exc))
        yield _step("admission.failed", "source", "failed", str(exc))
        return
    yield _step("admission.step", "source", "passed",
                f"{path.name} · {round(path.stat().st_size / (1024**3), 2)} GB · {source}")

    # 2. Integrity
    yield _step("admission.step", "integrity", "running", "Computing SHA-256…")
    digest = _sha256(path)
    expected = catalog_entry.get("sha256") or ""
    if expected and digest.lower() != expected.lower():
        yield _step("admission.step", "integrity", "failed",
                    f"SHA-256 mismatch: expected {expected[:16]}…, got {digest[:16]}…")
        yield _step("admission.failed", "integrity", "failed", "Integrity verification failed")
        return
    yield _step("admission.step", "integrity", "passed", f"SHA-256 {digest[:16]}…{digest[-8:]}")

    # 3. Metadata
    yield _step("admission.step", "metadata", "running", "Inspecting GGUF header…")
    try:
        metadata = inspect_gguf(path)
    except Exception as exc:
        yield _step("admission.step", "metadata", "failed", f"GGUF inspection failed: {exc}")
        yield _step("admission.failed", "metadata", "failed", str(exc))
        return
    yield _step("admission.step", "metadata", "passed",
                f"{metadata['name']} · {metadata['architecture']} · {metadata['quantization']} · "
                f"{metadata.get('parameter_count') or '?'} params")

    # 4. Hardware fit
    yield _step("admission.step", "hardware-fit", "running", "Evaluating hardware compatibility…")
    fit = _hardware_fit(metadata)
    if not fit["ok"]:
        yield _step("admission.step", "hardware-fit", "failed", fit["detail"])
        yield _step("admission.failed", "hardware-fit", "failed", fit["detail"])
        return
    yield _step("admission.step", "hardware-fit", "passed", fit["detail"])

    # 5. Policy
    yield _step("admission.step", "policy", "running", "Checking security & governance policy…")
    checks = run_checks(path, metadata, role)
    failed = [c for c in checks if c["status"] == "failed"]
    if failed:
        detail = "; ".join(f"{c['label']}: {c['detail']}" for c in failed)
        yield _step("admission.step", "policy", "failed", detail)
        yield _step("admission.failed", "policy", "failed", detail)
        return
    yield _step("admission.step", "policy", "passed",
                f"{len(checks)}/{len(checks)} governance checks passed")

    # 6. Node selection
    yield _step("admission.step", "node", "running", "Selecting deployment node…")
    nodes = _nodes()
    node = nodes[0] if nodes else {"name": "CPU-NODE-01"}
    yield _step("admission.step", "node", "passed",
                f"{node['name']}" + (f" · {node.get('gpu')} · {node.get('vram_gb')} GB" if node.get("gpu") else ""))

    # 7. Port allocation
    yield _step("admission.step", "port", "running", "Allocating runtime port…")
    try:
        port = _allocate_port()
    except RuntimeError as exc:
        yield _step("admission.step", "port", "failed", str(exc))
        yield _step("admission.failed", "port", "failed", str(exc))
        return
    yield _step("admission.step", "port", "passed", f"Port {port} allocated on 127.0.0.1")

    # 8. Registration
    yield _step("admission.step", "register", "running", "Registering model in the sovereign registry…")
    endpoint = f"http://127.0.0.1:{port}/completion"
    name = catalog_entry.get("name") or metadata.get("name") or path.stem
    capabilities_final = capabilities or catalog_entry.get("capabilities") or metadata.get("capabilities", []) or []
    context = runtime_context_tokens or metadata.get("model_context_tokens") or catalog_entry.get("context") or 4096
    try:
        model_registry.add_model(ModelEntry(
            role=role,
            endpoint=endpoint,
            model_path=str(path.relative_to(_MODEL_DIR.resolve())).replace("\\", "/"),
            name=name,
            model_id=catalog_entry.get("model_id", ""),
            capabilities=capabilities_final,
            description=description or catalog_entry.get("description", ""),
            runtime_context_tokens=int(context),
            load_policy=catalog_entry.get("load_policy", "on_demand"),
            priority=100,
            gpu_node=node.get("name", "local"),
            enabled=True,
        ), serve={"node": node.get("name"), "port": port, "host": "127.0.0.1",
                   "admitted_sha256": digest, "source": source, "catalog_key": catalog_key or ""})
    except Exception as exc:
        yield _step("admission.step", "register", "failed", str(exc))
        yield _step("admission.failed", "register", "failed", str(exc))
        return
    yield _step("admission.step", "register", "passed", f"Active routing slot {role.upper()} → {name}")

    # 9. Health check
    yield _step("admission.step", "health", "running", f"Probing llama.cpp health at port {port}…")
    healthy = _probe_health(port)
    if healthy:
        yield _step("admission.step", "health", "passed", f"127.0.0.1:{port}/health → 200 OK")
    else:
        yield _step("admission.step", "health", "passed",
                    f"No llama.cpp server on port {port} yet — registered offline. "
                    f"Start it with: llama-server -m backend/models/{path.name} --port {port}")
    status = "ready" if healthy else "registered_offline"

    # 10. Audit record
    summary = {
        "model_name": name,
        "catalog_key": catalog_key or "",
        "source": source,
        "role": role,
        "sha256": digest,
        "port": port,
        "node": node.get("name", "local"),
        "status": "admitted",
        "runtime_status": status,
        "checks": checks,
        "metadata": {k: v for k, v in metadata.items() if k != "model_path"},
        "admitted_by": admitted_by,
        "admitted_at": datetime.now(timezone.utc).isoformat(),
    }
    audit_id = None
    if persist_audit is not None:
        try:
            audit_id = persist_audit(summary)
        except Exception as exc:  # audit failure must not undo admission
            logger.warning("Audit persist failed: %s", exc)
    log_event("INFO", f"Model admitted: {name} (role={role}, port={port}, sha256={digest[:12]}…)")
    yield _step("admission.completed", "done", status,
                f"{name} · {role.upper()} · 127.0.0.1:{port}", audit_id=audit_id, summary=summary)


def _hardware_fit(metadata: dict) -> dict:
    est_vram = float(metadata.get("estimated_vram_gb") or 0)
    gpu = _detect_gpu()
    if not gpu["name"]:
        return {"ok": True, "detail": f"CPU inference · ~{est_vram} GB weights (no GPU detected)"}
    total = float(gpu["total_vram_gb"] or 0)
    headroom = round(total - est_vram, 1)
    if est_vram > total:
        return {"ok": False, "detail": f"Requires ~{est_vram} GB VRAM, node has {total} GB — will not fit"}
    return {"ok": True,
            "detail": f"{gpu['name']} · {total} GB VRAM · model needs ~{est_vram} GB · headroom {headroom} GB"}


def _probe_health(port: int) -> bool:
    import requests
    try:
        return requests.get(f"http://127.0.0.1:{port}/health", timeout=2).status_code == 200
    except requests.RequestException:
        return False


def precheck(*, source: str, role: str, catalog_key: Optional[str] = None, model_path: str = "") -> dict:
    """Synchronous pre-flight check for the wizard's "Model Admission Check" screen."""
    try:
        path = resolve_source(source, catalog_key, model_path)
        metadata = inspect_gguf(path)
        checks = run_checks(path, metadata, role)
        passed = all(c["status"] == "passed" for c in checks)
        return {
            "status": "passed" if passed else "failed",
            "passed": sum(1 for c in checks if c["status"] == "passed"),
            "total": len(checks),
            "checks": checks,
            "metadata": metadata,
            "hardware": _hardware_fit(metadata),
            "nodes": _nodes(),
            "policy": _load_policies().get("model_admission", {}),
        }
    except Exception as exc:
        return {"status": "failed", "passed": 0, "total": 0, "checks": [],
                "metadata": None, "hardware": {"ok": False, "detail": str(exc)},
                "nodes": _nodes(), "policy": _load_policies().get("model_admission", {}),
                "error": str(exc)}
