"""
RAG Ingestor — chunks documents and stores embeddings in ChromaDB.

Uses sentence-transformers for local embeddings (no external API).
The actual vector search / grounding in chat responses is a next step —
this module handles the ingestion side so "Indexed" status is real.

Install:
    pip install chromadb sentence-transformers
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ChromaDB persist directory
_CHROMA_DIR = Path(__file__).resolve().parents[2] / "data" / "chroma"
_CHROMA_DIR.mkdir(parents=True, exist_ok=True)

_CHUNK_SIZE = 500   # chars
_CHUNK_OVERLAP = 50

# ---------------------------------------------------------------------------
# Lazy imports — graceful degradation if not installed
# ---------------------------------------------------------------------------

_chroma_client = None
_embedding_fn = None
_collection = None


def _init_chroma():
    global _chroma_client, _collection, _embedding_fn
    if _chroma_client is not None:
        return True
    try:
        import chromadb
        from sentence_transformers import SentenceTransformer

        _chroma_client = chromadb.PersistentClient(path=str(_CHROMA_DIR))

        # ChromaDB 1.x uses a callable embedding function interface
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")

        class _EmbedFn:
            def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
                return _st_model.encode(input, convert_to_numpy=True).tolist()

        _embedding_fn = _EmbedFn()
        _collection = _chroma_client.get_or_create_collection(
            name="mrpl_documents",
            embedding_function=_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB 1.x initialised at %s", _CHROMA_DIR)
        return True
    except ImportError as exc:
        logger.warning("ChromaDB/sentence-transformers not installed: %s", exc)
        return False
    except Exception as exc:
        logger.warning("ChromaDB init failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ingest_document(
    text: str,
    filename: str,
    doc_id: Optional[int] = None,
) -> dict:
    """
    Chunk *text* and upsert into ChromaDB.

    Returns
    -------
    dict
        {"status": "indexed" | "unavailable", "chunks": int}
    """
    if not _init_chroma():
        return {"status": "unavailable", "chunks": 0,
                "reason": "ChromaDB not installed"}

    chunks = _chunk_text(text)
    if not chunks:
        return {"status": "unavailable", "chunks": 0, "reason": "No text to index"}

    doc_prefix = f"doc_{doc_id or filename}"
    ids = [f"{doc_prefix}_chunk_{i}" for i in range(len(chunks))]
    metas = [{"filename": filename, "doc_id": str(doc_id or ""), "chunk": i}
             for i in range(len(chunks))]

    try:
        _collection.upsert(documents=chunks, ids=ids, metadatas=metas)
        logger.info("Ingested %d chunks from %s into ChromaDB", len(chunks), filename)
        return {"status": "indexed", "chunks": len(chunks)}
    except Exception as exc:
        logger.error("ChromaDB upsert failed: %s", exc)
        return {"status": "unavailable", "chunks": 0, "reason": str(exc)}


def query_documents(query: str, n_results: int = 3) -> list[str]:
    """
    Retrieve the top-k relevant chunks for a query.
    Returns list of text chunks (empty list if ChromaDB unavailable).
    """
    if not _init_chroma() or _collection is None:
        return []
    try:
        results = _collection.query(
            query_texts=[query],
            n_results=min(n_results, _collection.count()),
        )
        return results.get("documents", [[]])[0]
    except Exception as exc:
        logger.warning("ChromaDB query failed: %s", exc)
        return []


def retrieve_sources(query: str, n_results: int = 3) -> list[dict]:
    """Retrieve top-k chunks with metadata, shaped as EvidenceSource dicts.

    Returns [] if ChromaDB is unavailable or the collection is empty — the
    orchestrator treats an empty list as "no grounding" rather than crashing.
    """
    if not _init_chroma() or _collection is None:
        return []
    try:
        count = _collection.count()
        if count == 0:
            return []
        results = _collection.query(
            query_texts=[query],
            n_results=min(n_results, count),
        )
    except Exception as exc:
        logger.warning("ChromaDB query failed: %s", exc)
        return []

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    dists = results.get("distances", [[]])[0]

    sources: list[dict] = []
    for i, chunk in enumerate(docs):
        meta = metas[i] if i < len(metas) else {}
        dist = dists[i] if i < len(dists) else 1.0
        filename = meta.get("filename", "knowledge")
        relevance = max(0.0, min(1.0, 1.0 - float(dist)))
        sources.append({
            "id": f"src-{i + 1}",
            "title": Path(filename).stem if filename else "knowledge",
            "section": f"chunk {meta.get('chunk', i)}",
            "relevanceScore": round(relevance, 2),
            "excerpt": (chunk or "")[:200],
            "sourceType": _infer_source_type(filename),
        })
    return sources


def _infer_source_type(filename: str) -> str:
    name = (filename or "").lower()
    if "sop" in name:
        return "sop"
    if "manual" in name:
        return "manual"
    if "standard" in name or "is-" in name or "astm" in name:
        return "standard"
    if "previous" in name or "approval" in name:
        return "previous-task"
    return "document"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + _CHUNK_SIZE
        chunks.append(text[start:end])
        start += _CHUNK_SIZE - _CHUNK_OVERLAP
    return [c.strip() for c in chunks if c.strip()]
