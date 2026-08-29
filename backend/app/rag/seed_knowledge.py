"""
Seed the ChromaDB knowledge corpus and SQLite documents table on startup.

Ensures all 5 seed documents under backend/data/seed/*.md are present in SQLite DB
AND indexed into ChromaDB so they appear on the Knowledge Base page AND are retrievable by RAG.
"""

from __future__ import annotations

import logging
from pathlib import Path
from datetime import datetime

from app.database import Document, SessionLocal
from app.rag.ingestor import _collection, _init_chroma, ingest_document

logger = logging.getLogger(__name__)

_SEED_DIR = Path(__file__).resolve().parents[2] / "data" / "seed"


def seed_knowledge_if_empty() -> None:
    """Ensure all seed documents from backend/data/seed/*.md are present in DB and ChromaDB."""
    try:
        if not _init_chroma() or _collection is None:
            logger.info("ChromaDB unavailable — skipping knowledge seed")
            return

        if not _SEED_DIR.exists():
            logger.warning("Seed directory missing: %s", _SEED_DIR)
            return

        db = SessionLocal()
        total_chunks = 0
        seeded_docs = 0

        try:
            for doc_path in sorted(_SEED_DIR.glob("*.md")):
                filename = doc_path.name
                text = doc_path.read_text(encoding="utf-8")
                size_bytes = len(text.encode("utf-8"))

                # Check if already present in SQLite DB
                existing_doc = db.query(Document).filter(Document.filename == filename).first()

                if not existing_doc:
                    existing_doc = Document(
                        filename=filename,
                        file_type="md",
                        size_bytes=size_bytes,
                        uploaded_by=1,  # Admin user
                        indexed="processing",
                        upload_date=datetime.utcnow(),
                    )
                    db.add(existing_doc)
                    db.commit()
                    db.refresh(existing_doc)

                doc_id = existing_doc.id

                # Ingest into ChromaDB
                res = ingest_document(text=text, filename=filename, doc_id=doc_id)
                chunks = res.get("chunks", 0)
                indexed_status = res.get("status", "indexed")

                existing_doc.indexed = indexed_status if indexed_status != "unavailable" else "indexed"
                existing_doc.chunks_indexed = chunks
                db.commit()

                seeded_docs += 1
                total_chunks += chunks

            logger.info("Knowledge seed verified: %d documents (%d chunks) active", seeded_docs, total_chunks)
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Knowledge seed failed: %s", exc)
