"""Dependency-free smoke test for the offline Model Admission Pipeline.

Run from ``backend`` with:
    python tests/test_model_admission_smoke.py

It creates a minimal valid GGUF only long enough to exercise inspection,
policy checks, registration and the streamed completion event.  The existing
``models.yaml`` content and the temporary package are restored in ``finally``.
"""

from __future__ import annotations

import struct
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models import admission, registry


MODELS_PATH = BACKEND_ROOT / "models.yaml"
TEST_GGUF = BACKEND_ROOT / "models" / "Synthetic-Qwen3-Test-Q4_K_M.gguf"


def _u64_string(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return struct.pack("<Q", len(encoded)) + encoded


def _metadata_string(key: str, value: str) -> bytes:
    return _u64_string(key) + struct.pack("<I", 8) + _u64_string(value)


def _metadata_u32(key: str, value: int) -> bytes:
    return _u64_string(key) + struct.pack("<I", 4) + struct.pack("<I", value)


def _write_synthetic_gguf(path: Path) -> None:
    metadata = [
        _metadata_string("general.architecture", "qwen3"),
        _metadata_string("general.name", "Synthetic Qwen3 Test Q4_K_M"),
        _metadata_string("general.size_label", "1B"),
        _metadata_u32("qwen3.context_length", 4096),
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"GGUF" + struct.pack("<IQQ", 3, 0, len(metadata)) + b"".join(metadata))


def main() -> None:
    original_models = MODELS_PATH.read_bytes()
    _write_synthetic_gguf(TEST_GGUF)
    try:
        preflight = admission.precheck(source="local", role="coder", model_path=TEST_GGUF.name)
        assert preflight["status"] == "passed", preflight
        assert preflight["passed"] == preflight["total"]

        events = list(admission.admit_model_stream(
            source="local",
            role="coder",
            model_path=TEST_GGUF.name,
            admitted_by="smoke-test",
        ))
        assert events[-1]["type"] == "admission.completed", events
        assert events[-1]["status"] == "registered_offline", events[-1]
        assert any(event["step"] == "register" and event["status"] == "passed" for event in events)
        print("Model admission smoke test passed.")
    finally:
        MODELS_PATH.write_bytes(original_models)
        registry.reload_models()
        TEST_GGUF.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
