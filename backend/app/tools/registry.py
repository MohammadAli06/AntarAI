from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

import yaml

_CONFIG_PATH = Path(__file__).resolve().parents[2] / "tools.yaml"
_lock = RLock()
_tools: list[dict] = []


def reload_tools() -> list[dict]:
    global _tools
    data = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    loaded = data.get("tools", [])
    with _lock:
        _tools = [dict(tool) for tool in loaded]
        return [dict(tool) for tool in _tools]


def _persist() -> None:
    _CONFIG_PATH.write_text(
        yaml.safe_dump({"tools": _tools}, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def is_tool_enabled(tool_type: str) -> bool:
    with _lock:
        match = next((tool for tool in _tools if tool.get("tool_type") == tool_type), None)
    return bool(match is None or match.get("enabled", True))


def set_enabled(name: str, enabled: bool, toggled_by: str = "system") -> dict:
    """Persist a tool state change together with its governance audit metadata."""
    with _lock:
        tool = next((item for item in _tools if item.get("name") == name), None)
        if tool is None:
            raise KeyError(name)
        tool["enabled"] = enabled
        tool["last_toggled_by"] = toggled_by
        tool["last_toggled_at"] = datetime.now(timezone.utc).isoformat()
        _persist()
        return dict(tool)


def _probe(tool_type: str) -> tuple[bool, dict]:
    try:
        if tool_type == "sandbox":
            from app.tools.code_sandbox import run_code_sandbox  # noqa: F401
            return True, {}
        if tool_type == "ocr":
            from app.tools.ocr_extractor import _TESSERACT_AVAILABLE
            return bool(_TESSERACT_AVAILABLE), {}
        if tool_type == "document-gen":
            import docx  # noqa: F401
            return True, {}
        if tool_type == "rag":
            from app.rag.ingestor import is_reachable, is_seeded
            return is_reachable(), {"seeded": is_seeded()}
        if tool_type == "verification":
            from app.tools.verifier import verify_artifact  # noqa: F401
            return True, {}
        if tool_type == "model":
            from app.models.registry import list_models
            return any(model.get("status") == "online" for model in list_models()), {}
    except Exception:
        return False, {}
    return False, {}


def list_tools() -> list[dict]:
    with _lock:
        configured = [dict(tool) for tool in _tools]
    result = []
    for tool in configured:
        available, extra = _probe(str(tool.get("tool_type", "")))
        enabled = bool(tool.get("enabled", True))
        result.append({
            "name": tool.get("name", "Unnamed tool"),
            "toolType": tool.get("tool_type", "unknown"),
            "enabled": enabled,
            "status": "disabled" if not enabled else ("online" if available else "offline"),
            "networkBlocked": bool(tool.get("network_blocked", False)),
            "description": tool.get("description", ""),
            "lastToggledBy": tool.get("last_toggled_by"),
            "lastToggledAt": tool.get("last_toggled_at"),
            **extra,
        })
    return result


reload_tools()
