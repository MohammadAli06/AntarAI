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
import os
import hashlib
import math
import re
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ChromaDB persist directory
_CHROMA_DIR = Path(__file__).resolve().parents[2] / "data" / "chroma"
_CHROMA_DIR.mkdir(parents=True, exist_ok=True)

_CHUNK_SIZE = 500   # chars
_CHUNK_OVERLAP = 50
# A vector store always returns its nearest chunks, even when none are useful.
# Do not present those weak neighbours as evidence in an agent response.
_MIN_EVIDENCE_RELEVANCE = 0.35

# ---------------------------------------------------------------------------
# Lazy imports — graceful degradation if not installed
# ---------------------------------------------------------------------------

_chroma_client = None
_embedding_fn = None
_collection = None


def _init_chroma():
    global _chroma_client, _collection, _embedding_fn
    if _collection is not None:
        return True
    try:
        import chromadb

        if _chroma_client is None:
            _chroma_client = chromadb.PersistentClient(path=str(_CHROMA_DIR))

        # Prefer the configured local transformer. Never download at runtime:
        # a deterministic hashing fallback keeps this air-gapped installation
        # usable even when no Hugging Face model has been pre-cached.
        embedding_model = os.getenv("ANTARAI_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        try:
            from sentence_transformers import SentenceTransformer
            st_model = SentenceTransformer(embedding_model, local_files_only=True)

            class _SentenceTransformerEmbedding:
                def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
                    return st_model.encode(input, convert_to_numpy=True).tolist()

                def embed_query(self, input: list[str]) -> list[list[float]]:  # noqa: A002
                    return self(input)

                @staticmethod
                def name() -> str:
                    return "antarai-local-sentence-transformer"

            _embedding_fn = _SentenceTransformerEmbedding()
            logger.info("Using local sentence-transformer embeddings: %s", embedding_model)
        except Exception as exc:
            logger.warning("Local embedding model unavailable; using offline hash embeddings: %s", exc)
            _embedding_fn = _HashEmbedding()

        _collection = _chroma_client.get_or_create_collection(
            name="mrpl_documents",
            embedding_function=_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB 1.x initialised at %s", _CHROMA_DIR)
        return True
    except ImportError as exc:
        logger.warning("ChromaDB not installed: %s", exc)
        return False
    except Exception as exc:
        logger.warning("ChromaDB init failed: %s", exc)
        return False


class _HashEmbedding:
    """Small deterministic local embedding fallback with no model download."""

    dimensions = 384

    @staticmethod
    def name() -> str:
        return "antarai-offline-hash-v1"

    def __call__(self, input: list[str]) -> list[list[float]]:  # noqa: A002
        vectors: list[list[float]] = []
        for value in input:
            vector = [0.0] * self.dimensions
            tokens = re.findall(r"[a-z0-9]+", (value or "").lower())
            features = tokens + [f"{tokens[i]}_{tokens[i + 1]}" for i in range(len(tokens) - 1)]
            for feature in features:
                digest = hashlib.sha256(feature.encode("utf-8")).digest()
                slot = int.from_bytes(digest[:4], "big") % self.dimensions
                vector[slot] += 1.0 if digest[4] & 1 else -1.0
            norm = math.sqrt(sum(component * component for component in vector)) or 1.0
            vectors.append([component / norm for component in vector])
        return vectors

    def embed_query(self, input: list[str]) -> list[list[float]]:  # noqa: A002
        return self(input)


# ---------------------------------------------------------------------------
# Public health API
# ---------------------------------------------------------------------------

def is_reachable() -> bool:
    """Whether the local ChromaDB collection can be opened, regardless of data."""
    global _chroma_client
    try:
        import chromadb
        if _chroma_client is None:
            _chroma_client = chromadb.PersistentClient(path=str(_CHROMA_DIR))
        _chroma_client.heartbeat()
        return True
    except Exception as exc:
        logger.warning("ChromaDB reachability probe failed: %s", exc)
        return False


def is_seeded() -> bool:
    """Whether the reachable collection currently contains indexed chunks."""
    try:
        if not is_reachable():
            return False
        collection = _chroma_client.get_collection("mrpl_documents")
        return collection.count() > 0
    except Exception:
        return False


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
        count = _collection.count()
        if count == 0:
            return []
        results = _collection.query(
            query_texts=[query],
            n_results=min(n_results, count),
        )
        return results.get("documents", [[]])[0]
    except Exception as exc:
        logger.warning("ChromaDB query failed: %s", exc)
        return []


def search_document(doc_id: int, query: str, n_results: int = 5) -> list[dict]:
    """Search only chunks belonging to one uploaded Knowledge Base document."""
    if not query.strip() or not _init_chroma() or _collection is None:
        return []
    try:
        if _collection.count() == 0:
            return []
        results = _collection.query(
            query_texts=[query.strip()],
            n_results=max(1, min(n_results, 20)),
            where={"doc_id": str(doc_id)},
        )
        return _shape_results(results)
    except Exception as exc:
        logger.warning("Document-scoped query failed for %s: %s", doc_id, exc)
        return []


def delete_document(doc_id: int) -> None:
    """Remove all vector chunks for a database document."""
    if not _init_chroma() or _collection is None:
        return
    try:
        _collection.delete(where={"doc_id": str(doc_id)})
    except Exception as exc:
        logger.warning("Vector cleanup failed for document %s: %s", doc_id, exc)


import time
from app.system_log import log_event


def retrieve_sources(query: str, n_results: int = 3, min_relevance: float = _MIN_EVIDENCE_RELEVANCE) -> list[dict]:
    """Retrieve top-k chunks with metadata, shaped as EvidenceSource dicts.

    Returns [] if ChromaDB is unavailable or the collection is empty — the
    orchestrator treats an empty list as "no grounding" rather than crashing.
    """
    t0 = time.perf_counter()
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
        if relevance < min_relevance:
            continue
        sources.append({
            "id": f"src-{i + 1}",
            "title": Path(filename).stem if filename else "knowledge",
            "section": f"chunk {meta.get('chunk', i)}",
            "relevanceScore": round(relevance, 2),
            "excerpt": (chunk or "")[:200],
            "sourceType": _infer_source_type(filename),
        })

    elapsed = time.perf_counter() - t0
    log_event("RETR", f"Vector search executed: {elapsed:.3f}s (relevant results: {len(sources)})")
    return sources


def search_all_documents(query: str, n_results: int = 15) -> list[dict]:
    """Search vector chunks across all indexed Knowledge Base documents."""
    if not query.strip() or not _init_chroma() or _collection is None:
        return []
    try:
        if _collection.count() == 0:
            return []
        results = _collection.query(
            query_texts=[query.strip()],
            n_results=max(1, min(n_results, 30)),
        )
        return _shape_results(results)
    except Exception as exc:
        logger.warning("Global vector search failed: %s", exc)
        return []


def _shape_results(results: dict) -> list[dict]:
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    dists = results.get("distances", [[]])[0]
    matches: list[dict] = []
    for index, chunk in enumerate(docs):
        meta = metas[index] if index < len(metas) else {}
        distance = dists[index] if index < len(dists) else 1.0
        matches.append({
            "id": f"match-{index + 1}",
            "excerpt": (chunk or "")[:500],
            "relevanceScore": round(max(0.0, min(1.0, 1.0 - float(distance))), 2),
            "filename": meta.get("filename", "knowledge"),
            "doc_id": meta.get("doc_id", ""),
            "chunk": meta.get("chunk", index),
        })
    return matches


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
