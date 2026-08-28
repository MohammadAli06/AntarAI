"""
Seed the ChromaDB knowledge corpus on startup if the collection is empty.

The seed documents under backend/data/seed/ are representative MRPL engineering
references (SOPs, standards, manuals, prior approval notes) — real corpus
content so RAG retrieval returns grounded evidence, not empty results.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.rag.ingestor import _collection, _init_chroma, ingest_document

logger = logging.getLogger(__name__)

_SEED_DIR = Path(__file__).resolve().parents[2] / "data" / "seed"


def seed_knowledge_if_empty() -> None:
    try:
        if not _init_chroma() or _collection is None:
            logger.info("ChromaDB unavailable — skipping knowledge seed")
            return
        if _collection.count() > 0:
            logger.info("Knowledge corpus already populated (%d chunks) — skipping seed", _collection.count())
            return

        if not _SEED_DIR.exists():
            logger.warning("Seed directory missing: %s", _SEED_DIR)
            return

        total = 0
        for doc in sorted(_SEED_DIR.glob("*.md")):
            text = doc.read_text(encoding="utf-8")
            res = ingest_document(text=text, filename=doc.name, doc_id=doc.stem)
            total += res.get("chunks", 0)
        logger.info("Seeded knowledge corpus: %d chunks from %s", total, _SEED_DIR)
    except Exception as exc:  # pragma: no cover - startup best-effort
        logger.warning("Knowledge seed failed: %s", exc)
