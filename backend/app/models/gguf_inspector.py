"""Small, dependency-free GGUF metadata reader for local model registration."""

from __future__ import annotations

import re
import struct
from pathlib import Path
from typing import BinaryIO, Any


_TYPE_UINT8 = 0
_TYPE_INT8 = 1
_TYPE_UINT16 = 2
_TYPE_INT16 = 3
_TYPE_UINT32 = 4
_TYPE_INT32 = 5
_TYPE_FLOAT32 = 6
_TYPE_BOOL = 7
_TYPE_STRING = 8
_TYPE_ARRAY = 9
_TYPE_UINT64 = 10
_TYPE_INT64 = 11
_TYPE_FLOAT64 = 12

_SCALARS: dict[int, tuple[str, int]] = {
    _TYPE_UINT8: ("<B", 1), _TYPE_INT8: ("<b", 1),
    _TYPE_UINT16: ("<H", 2), _TYPE_INT16: ("<h", 2),
    _TYPE_UINT32: ("<I", 4), _TYPE_INT32: ("<i", 4),
    _TYPE_FLOAT32: ("<f", 4), _TYPE_BOOL: ("<?", 1),
    _TYPE_UINT64: ("<Q", 8), _TYPE_INT64: ("<q", 8),
    _TYPE_FLOAT64: ("<d", 8),
}


def _read_exact(stream: BinaryIO, size: int) -> bytes:
    value = stream.read(size)
    if len(value) != size:
        raise ValueError("Unexpected end of GGUF metadata")
    return value


def _read_u32(stream: BinaryIO) -> int:
    return struct.unpack("<I", _read_exact(stream, 4))[0]


def _read_u64(stream: BinaryIO) -> int:
    return struct.unpack("<Q", _read_exact(stream, 8))[0]


def _read_string(stream: BinaryIO) -> str:
    length = _read_u64(stream)
    return _read_exact(stream, length).decode("utf-8", errors="replace")


def _read_value(stream: BinaryIO, value_type: int) -> Any:
    if value_type == _TYPE_STRING:
        return _read_string(stream)
    if value_type == _TYPE_ARRAY:
        item_type = _read_u32(stream)
        count = _read_u64(stream)
        # Metadata arrays are rarely needed for registration. Read a small
        # textual/numeric array; otherwise skip without allocating huge data.
        if count > 10_000:
            for _ in range(count):
                _read_value(stream, item_type)
            return f"[{count} values]"
        return [_read_value(stream, item_type) for _ in range(count)]
    scalar = _SCALARS.get(value_type)
    if scalar is None:
        raise ValueError(f"Unsupported GGUF metadata type: {value_type}")
    fmt, size = scalar
    return struct.unpack(fmt, _read_exact(stream, size))[0]


def _quantization_from_name(name: str) -> str | None:
    match = re.search(r"\b(Q\d(?:_[A-Z0-9]+)*)\b|\b(F\d{2})\b", name.upper())
    return match.group(1) or match.group(2) if match else None


def _parameter_label(name: str, size_label: str | None) -> str | None:
    if size_label:
        return size_label
    match = re.search(r"\b(\d+(?:\.\d+)?[BM])\b", name.upper())
    return match.group(1) if match else None


def inspect_gguf(path: Path) -> dict[str, Any]:
    """Read metadata from a GGUF header without loading model weights."""
    if not path.is_file() or path.suffix.lower() != ".gguf":
        raise ValueError("Select an existing .gguf model file")

    with path.open("rb") as stream:
        if _read_exact(stream, 4) != b"GGUF":
            raise ValueError("File is not a valid GGUF model")
        version = _read_u32(stream)
        if version < 2:
            raise ValueError(f"Unsupported GGUF version: {version}")
        tensor_count = _read_u64(stream)
        metadata_count = _read_u64(stream)
        metadata: dict[str, Any] = {}
        for _ in range(metadata_count):
            key = _read_string(stream)
            value_type = _read_u32(stream)
            metadata[key] = _read_value(stream, value_type)

    architecture = str(metadata.get("general.architecture") or "unknown")
    name = str(metadata.get("general.name") or path.stem)
    context = next(
        (value for key, value in metadata.items() if key.endswith(".context_length") and isinstance(value, int)),
        None,
    )
    quantization = _quantization_from_name(path.name) or _quantization_from_name(name) or "unknown"
    size_bytes = path.stat().st_size
    # This deliberately estimates only model weights. KV-cache, context,
    # batch size and GPU offload are runtime-dependent and shown separately.
    estimated_vram_gb = round((size_bytes / (1024 ** 3)) * 1.10, 2)
    return {
        "name": name,
        "format": "GGUF",
        "architecture": architecture,
        "quantization": quantization,
        "parameter_count": _parameter_label(name, metadata.get("general.size_label")),
        "model_context_tokens": context,
        "file_size_bytes": size_bytes,
        "tensor_count": tensor_count,
        "gguf_version": version,
        "estimated_vram_gb": estimated_vram_gb,
    }
