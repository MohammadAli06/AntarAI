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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

_CONFIG_PATH = Path(__file__).resolve().parents[2] / "models.yaml"


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"models.yaml not found at {_CONFIG_PATH}")
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


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
        yaml.safe_dump(_config, file, sort_keys=False, allow_unicode=True)


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
    if not validate_endpoint(entry.endpoint):
        raise ValueError(f"Endpoint not reachable: {entry.endpoint}")
    with _config_lock:
        _config[entry.role] = entry.model_dump(exclude_none=True)
        _persist_config()


def remove_model(role: str) -> None:
    if role == "general":
        raise ValueError("The general fallback model cannot be removed")
    with _config_lock:
        if role not in _config:
            raise KeyError(role)
        del _config[role]
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
    """Return registry entries with live reachability status."""
    result = []
    endpoint_status: dict[str, str] = {}
    with _config_lock:
        configured = list(_config.items())
    for role, info in configured:
        endpoint = info.get("endpoint", "http://127.0.0.1:8081/completion")
        base = endpoint.rsplit("/", 1)[0]           # strip /completion
        health_url = f"{base}/health"

        # Only probe each server once
        if health_url not in endpoint_status:
            try:
                r = requests.get(health_url, timeout=2)
                status = "online" if r.status_code == 200 else "offline"
            except Exception:
                status = "offline"
            endpoint_status[health_url] = status
        else:
            status = endpoint_status[health_url]

        result.append({
            "role": role,
            "name": info["name"],
            "model_id": info.get("model_id", ""),
            "endpoint": endpoint,
            "description": info.get("description", ""),
            "format": info.get("format", "GGUF"),
            "quantization": info.get("quantization", "Q4_K_M"),
            "vram_gb": info.get("vram_gb"),
            "context_tokens": info.get("context_tokens"),
            "capabilities": info.get("capabilities", []),
            "status": status,
            "active": is_role_active(role),
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
