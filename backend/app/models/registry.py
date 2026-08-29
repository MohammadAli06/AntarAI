"""
Model Registry — wires call_model() to the real Qwen3-8B-Q4_K_M instance
running via llama.cpp server on 127.0.0.1:8081.

Architecture note (for mentor/judge Q&A):
  - All three roles (general, coder, vision) currently route to the same
    Qwen3-8B-Q4_K_M model.  Role-specific prompting compensates.
  - The routing logic (classify_task → role → endpoint lookup) is fully
    implemented — a second dedicated model (e.g. Qwen3-Coder-7B) can be
    added to models.yaml and will be picked up without any code change.
    VRAM constraints at this stage limit us to one loaded model.
"""

from __future__ import annotations

import logging
import re
import time
from threading import RLock
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests
import yaml
from app.system_log import log_event
from app.models.schemas import ModelEntry
from app.models.gguf_inspector import inspect_gguf

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

_CONFIG_PATH = Path(__file__).resolve().parents[2] / "models.yaml"
_MODEL_DIR = Path(__file__).resolve().parents[2] / "models"


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"models.yaml not found at {_CONFIG_PATH}")
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if isinstance(data, dict) and "models" in data and isinstance(data["models"], dict):
        return data["models"]
    return data if isinstance(data, dict) else {}


_config_lock = RLock()
_config: dict = _load_config()


def reload_models() -> dict:
    global _config
    loaded = _load_config()
    with _config_lock:
        _config = loaded
        return dict(_config)


def _persist_config() -> None:
    with open(_CONFIG_PATH, "w", encoding="utf-8") as file:
        yaml.safe_dump({"models": _config}, file, sort_keys=False, allow_unicode=True)


def _detect_gpu() -> dict:
    try:
        import pynvml  # type: ignore
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        gpu_name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode("utf-8", errors="replace")
        info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        total_gb = round(info.total / (1024 ** 3), 1)
        pynvml.nvmlShutdown()
        return {"name": gpu_name, "total_vram_gb": total_gb, "available": True}
    except Exception:
        return {"name": None, "total_vram_gb": None, "available": False}


def _resolve_model_path(model_path: str) -> Path:
    if not model_path:
        raise ValueError("Select a GGUF file from backend/models")
    supplied = Path(model_path)
    resolved = supplied.resolve() if supplied.is_absolute() else (_MODEL_DIR / supplied).resolve()
    root = _MODEL_DIR.resolve()
    if root != resolved and root not in resolved.parents:
        raise ValueError("Model files must be placed under backend/models")
    return resolved


def inspect_model_file(model_path: str) -> dict:
    path = _resolve_model_path(model_path)
    result = inspect_gguf(path)
    result["model_path"] = str(path.relative_to(_MODEL_DIR.resolve())).replace("\\", "/")
    return result


def list_model_files() -> list[dict]:
    if not _MODEL_DIR.exists():
        return []
    result = []
    for path in _MODEL_DIR.rglob("*.gguf"):
        try:
            metadata = inspect_model_file(str(path))
            result.append({"path": metadata["model_path"], "metadata": metadata})
        except Exception as exc:
            result.append({"path": str(path.relative_to(_MODEL_DIR)).replace("\\", "/"), "error": str(exc)})
    return result


def validate_endpoint(endpoint: str, timeout: float = 3.0) -> bool:
    parsed = urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    health_url = endpoint.rstrip("/")
    if health_url.endswith("/completion"):
        health_url = health_url[:-len("/completion")] + "/health"
    else:
        health_url += "/health"
    try:
        return requests.get(health_url, timeout=timeout).status_code == 200
    except requests.RequestException:
        return False


def add_model(entry: ModelEntry) -> None:
    parsed = urlparse(entry.endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid local model endpoint URL")
    detected = inspect_model_file(entry.model_path)
    config = {
        "role": entry.role,
        "name": detected["name"],
        "model_id": entry.model_id,
        "endpoint": entry.endpoint,
        "model_path": detected["model_path"],
        "capabilities": entry.capabilities,
        "description": entry.description,
        "metadata": {key: value for key, value in detected.items() if key != "model_path"},
        "runtime": {
            "context_size": entry.runtime_context_tokens,
            "load_policy": entry.load_policy,
            "priority": entry.priority,
            "gpu_node": entry.gpu_node,
            "enabled": entry.enabled,
        },
    }
    with _config_lock:
        _config[entry.role] = config
        _persist_config()


def remove_model(role: str) -> None:
    if role == "general":
        raise ValueError("The general fallback model cannot be removed")
    with _config_lock:
        if role not in _config:
            raise KeyError(role)
        del _config[role]
        _persist_config()


def update_model_endpoint(role: str, endpoint: str) -> None:
    """Persist a registered model's runtime endpoint without re-registering its GGUF."""
    parsed = urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid local model endpoint URL")
    with _config_lock:
        if role not in _config:
            raise KeyError(role)
        _config[role]["endpoint"] = endpoint
        _persist_config()

# In-process sovereignty counter (also persisted to DB by main.py)
_call_counter: int = 0

# Roles currently mid-inference (set on call entry, cleared in finally)
_active_roles: set[str] = set()


def strip_thinking(text: str) -> str:
    """Remove reasoning blocks emitted by thinking-capable Qwen models.

    The completion endpoint may include a ``<think>...</think>`` preamble.
    It is useful to the model while generating, but it is not part of the
    user-facing answer and can break downstream code/document parsing.
    """
    return re.sub(r"<think>.*?</think>", "", text, flags=re.IGNORECASE | re.DOTALL).strip()


def get_call_count() -> int:
    return _call_counter


def is_role_active(role: str) -> bool:
    """Return True if a model call for *role* is currently in flight."""
    return role in _active_roles


def list_models() -> list[dict]:
    """Return configured runtime entries plus real local GGUF/GPU metadata."""
    result = []
    endpoint_status: dict[str, str] = {}
    gpu_info = _detect_gpu()
    with _config_lock:
        configured = list(_config.items())

    for role, info in configured:
        endpoint = info.get("endpoint", "http://127.0.0.1:8081/completion")
        parsed_endpoint = urlparse(endpoint)
        health_url = f"{parsed_endpoint.scheme}://{parsed_endpoint.netloc}/health"
        if health_url not in endpoint_status:
            try:
                status = "online" if requests.get(health_url, timeout=2).status_code == 200 else "offline"
            except Exception:
                status = "offline"
            endpoint_status[health_url] = status
        else:
            status = endpoint_status[health_url]

        metadata = dict(info.get("metadata") or {})
        inspection_error = None
        if info.get("model_path"):
            try:
                metadata = inspect_model_file(str(info["model_path"]))
            except Exception as exc:
                inspection_error = str(exc)
        runtime = dict(info.get("runtime") or {})
        runtime_context = runtime.get("context_size") or info.get("context_tokens")
        result.append({
            "role": role,
            "name": metadata.get("name") or info.get("name", role),
            "model_id": info.get("model_id", ""),
            "endpoint": endpoint,
            "description": info.get("description", ""),
            "model_path": info.get("model_path"),
            "format": metadata.get("format") or info.get("format"),
            "quantization": metadata.get("quantization") or info.get("quantization"),
            "architecture": metadata.get("architecture"),
            "parameter_count": metadata.get("parameter_count"),
            "file_size_bytes": metadata.get("file_size_bytes"),
            "tensor_count": metadata.get("tensor_count"),
            "model_context_tokens": metadata.get("model_context_tokens"),
            "estimated_vram_gb": metadata.get("estimated_vram_gb"),
            "runtime_context_tokens": runtime_context,
            "load_policy": runtime.get("load_policy", "on_demand"),
            "priority": runtime.get("priority", 100),
            "gpu_node": runtime.get("gpu_node", "local"),
            "enabled": runtime.get("enabled", True),
            "gpu_name": gpu_info["name"],
            "gpu_vram_gb": gpu_info["total_vram_gb"],
            "metadata_status": "error" if inspection_error else ("detected" if metadata else "not_inspected"),
            "inspection_error": inspection_error,
            "capabilities": info.get("capabilities", []),
            "status": "disabled" if runtime.get("enabled") is False else status,
            "active": is_role_active(role),
            # Compatibility aliases for existing consumers.
            "vram_gb": metadata.get("estimated_vram_gb"),
            "context_tokens": runtime_context,
        })
    return result


def get_model_for_role(role: str) -> dict:
    with _config_lock:
        info = _config.get(role, _config.get("general"))
    if info is None:
        raise RuntimeError("No general model is registered")
    return {
        "role": role,
        "name": info["name"],
        "model_id": info.get("model_id", ""),
        "endpoint": info.get("endpoint", "http://127.0.0.1:8081/completion"),
    }


# ---------------------------------------------------------------------------
# call_model — real llama.cpp HTTP call
# ---------------------------------------------------------------------------

_LLAMA_TIMEOUT = 120  # seconds


def call_model(
    role: str,
    prompt: str,
    image_path: Optional[str] = None,
    n_predict: int = 512,
    temperature: float = 0.7,
    stop: Optional[list[str]] = None,
) -> str:
    """
    Send *prompt* to the Qwen3-8B-Q4_K_M llama.cpp server and return the
    completion text.

    Parameters
    ----------
    role : str
        Logical role (general / coder / vision).  Used to look up endpoint.
    prompt : str
        Full prompt string (system preamble already included by orchestrator).
    image_path : str, optional
        Not yet used — placeholder for future vision model (llava-style).
    n_predict : int
        Max tokens to generate.
    temperature : float
        Sampling temperature.
    stop : list[str], optional
        Stop sequences passed to the server.

    Returns
    -------
    str
        The model's text completion.

    Raises
    ------
    RuntimeError
        If the llama.cpp server is unreachable or returns an error.
    """
    global _call_counter
    _call_counter += 1
    _active_roles.add(role)

    model_info = get_model_for_role(role)
    model_name = model_info["name"]
    endpoint = model_info["endpoint"]

    payload: dict = {
        "prompt": prompt,
        "n_predict": n_predict,
        "temperature": temperature,
        "stop": stop or ["</s>", "<|im_end|>"],
        "stream": False,
    }

    t0 = time.perf_counter()
    try:
        logger.info("Calling %s (role=%s) n_predict=%d", model_name, role, n_predict)
        resp = requests.post(endpoint, json=payload, timeout=_LLAMA_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        raw_response = data.get("content", "")
        clean_response = strip_thinking(raw_response)
        if clean_response != raw_response.strip():
            logger.info("Removed model reasoning block from completion (role=%s)", role)

        elapsed = time.perf_counter() - t0
        log_event("INFER", f"Inference complete ({model_name}). Latency: {elapsed:.2f}s")
        return clean_response
    except requests.Timeout as exc:
        elapsed = time.perf_counter() - t0
        err_msg = f"Qwen3-8B server at {endpoint} timed out after {_LLAMA_TIMEOUT}s."
        log_event("WARN", f"Model call failed ({model_name}): {err_msg}")
        raise RuntimeError(err_msg) from exc
    except requests.ConnectionError as exc:
        elapsed = time.perf_counter() - t0
        err_msg = f"Cannot reach Qwen3-8B server at {endpoint}."
        log_event("WARN", f"Model call failed ({model_name}): {err_msg}")
        raise RuntimeError(err_msg) from exc
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        log_event("WARN", f"Model call failed ({model_name}): {exc}")
        raise RuntimeError(f"Model call failed: {exc}") from exc
    finally:
        _active_roles.discard(role)
