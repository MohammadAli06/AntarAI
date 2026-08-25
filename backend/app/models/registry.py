"""
Model Registry — loads models.yaml and provides call_model() interface.

The call_model() function is the ONLY point of contact between the rest of
the application and the underlying LLM. When swapping mock → real llama.cpp,
only this file needs to change.
"""

import os
from pathlib import Path
from typing import Optional

import yaml


# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------

_CONFIG_PATH = Path(__file__).resolve().parents[2] / "models.yaml"

def _load_config() -> dict:
    """Read models.yaml from the backend root."""
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"models.yaml not found at {_CONFIG_PATH}")
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


_config: dict = _load_config()

# Track call counts for sovereignty stats
_call_counter: int = 0


def get_call_count() -> int:
    """Return the total number of local model calls made this session."""
    return _call_counter


def list_models() -> list[dict]:
    """Return a list of all registered models with status info."""
    models = []
    for role, info in _config.items():
        models.append({
            "role": role,
            "name": info["name"],
            "endpoint": info.get("endpoint", "http://localhost:8080/completion"),
            "description": info.get("description", ""),
            "status": "mock",  # Will become "online" / "offline" when real
        })
    return models


def get_model_for_role(role: str) -> dict:
    """Look up model config by role.  Falls back to 'general'."""
    info = _config.get(role, _config.get("general"))
    return {
        "role": role,
        "name": info["name"],
        "endpoint": info.get("endpoint", "http://localhost:8080/completion"),
    }


# ---------------------------------------------------------------------------
# call_model — the single integration point
# ---------------------------------------------------------------------------

# TODO: replace with real llama.cpp call
# When ready, replace the body of this function with an HTTP POST to
#   endpoint = get_model_for_role(role)["endpoint"]
#   payload  = {"prompt": prompt, "n_predict": 512, "temperature": 0.7}
#   response = httpx.post(endpoint, json=payload, timeout=120)
#   return response.json()["content"]

_MOCK_RESPONSES: dict[str, str] = {
    "general": (
        "Based on the available documentation and internal data, here is a "
        "comprehensive analysis:\n\n"
        "1. The refinery throughput for the current quarter is within expected "
        "parameters at 15.2 MMTPA.\n"
        "2. All safety compliance metrics are green.\n"
        "3. Recommended action: Continue current operational cadence and "
        "schedule the next review for Q3.\n\n"
        "This response was generated entirely on-premise using Qwen3-8B. "
        "Zero external network calls were made."
    ),
    "coder": (
        "```python\n"
        "import pandas as pd\n\n"
        "def calculate_throughput(daily_values: list[float]) -> dict:\n"
        '    """Calculate refinery throughput statistics."""\n'
        "    df = pd.DataFrame({'daily_mbpd': daily_values})\n"
        "    return {\n"
        '        "mean": round(df.daily_mbpd.mean(), 2),\n'
        '        "max": round(df.daily_mbpd.max(), 2),\n'
        '        "min": round(df.daily_mbpd.min(), 2),\n'
        '        "std_dev": round(df.daily_mbpd.std(), 2),\n'
        "    }\n"
        "```\n\n"
        "This code was generated on-premise using Qwen3-Coder. "
        "No data left the local network."
    ),
    "vision": (
        "**OCR / Image Analysis Result**\n\n"
        "The uploaded document appears to be a scanned maintenance log. "
        "Key extracted fields:\n"
        "- Equipment ID: CDU-04\n"
        "- Inspection Date: 2026-07-15\n"
        "- Status: Operational — minor corrosion noted on flange\n"
        "- Recommended Action: Schedule weld overlay within 60 days\n\n"
        "Processed locally using Qwen3-VL vision model. "
        "Document never left the air-gapped network."
    ),
}


def call_model(role: str, prompt: str, image_path: Optional[str] = None) -> str:
    """
    Send a prompt to the model assigned to *role* and return the completion.

    Parameters
    ----------
    role : str
        One of "general", "coder", "vision".
    prompt : str
        The user prompt (or system+user prompt assembled by the orchestrator).
    image_path : str, optional
        Path to a local image file (used by the vision model).

    Returns
    -------
    str
        The model's text response.

    # TODO: replace with real llama.cpp call
    # When swapping to the real backend, use:
    #   import httpx
    #   model = get_model_for_role(role)
    #   payload = {"prompt": prompt, "n_predict": 512, "temperature": 0.7}
    #   if image_path:
    #       payload["image_data"] = [{"data": base64(image_path), "id": 1}]
    #   resp = httpx.post(model["endpoint"], json=payload, timeout=120)
    #   return resp.json()["content"]
    """
    global _call_counter
    _call_counter += 1

    # ---- MOCK: return canned response based on role ----
    return _MOCK_RESPONSES.get(role, _MOCK_RESPONSES["general"])
