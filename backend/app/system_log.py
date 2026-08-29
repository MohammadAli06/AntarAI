"""
system_log.py — Shared in-process ring buffer for the SYSTEM LOG // stdout panel.

Push events here from any pipeline stage; AdminHome polls GET /system-log
and renders them as a live terminal feed.

Design:
  - Thread-safe via threading.Lock (uvicorn workers share process).
  - maxlen=50 — last 50 entries, negligible memory.
  - Timestamps: ISO 8601 with milliseconds, UTC.
  - log_event() never raises — called from hot paths, must be silent-fail.
  - No DB persistence needed; buffer resets on backend restart, acceptable
    for demo scope.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from threading import Lock

_log: deque[dict] = deque(maxlen=50)
_lock = Lock()


def log_event(level: str, message: str) -> None:
    """Append a timestamped entry.  level: INFO | RETR | BLOCK | INFER | WARN | TOOL | ERROR"""
    try:
        with _lock:
            _log.append({
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                "level": level,
                "message": message,
            })
    except Exception:  # pragma: no cover — never raise from hot paths
        pass


def get_recent(limit: int = 50) -> list[dict]:
    """Return the most recent *limit* entries, oldest first."""
    with _lock:
        return list(_log)[-limit:]
