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

_CHUNK_SIZE = 1500  # chars; keeps typical Markdown sections/tables together
_CHUNK_OVERLAP = 100
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

    chunk_pairs = _chunk_text(text)
    if not chunk_pairs:
        return {"status": "unavailable", "chunks": 0, "reason": "No text to index"}

    chunks = [chunk for chunk, _ in chunk_pairs]
    doc_prefix = f"doc_{doc_id or filename}"
    ids = [f"{doc_prefix}_chunk_{i}" for i in range(len(chunks))]
    # Small-to-big retrieval: embed and match on the chunk, but store the full
    # parent section alongside it so retrieval can return complete context.
    metas = [{"filename": filename, "doc_id": str(doc_id or ""), "chunk": i,
              "parent_section": parent}
             for i, (_, parent) in enumerate(chunk_pairs)]

    try:
        # Re-indexing a document must replace its previous chunk layout. Without
        # this, obsolete character-sliced chunks remain searchable beside the
        # new section-preserving chunks.
        if doc_id is not None:
            _collection.delete(where={"doc_id": str(doc_id)})
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
    seen_sections: set[str] = set()
    for i, chunk in enumerate(docs):
        meta = metas[i] if i < len(metas) else {}
        dist = dists[i] if i < len(dists) else 1.0
        filename = meta.get("filename", "knowledge")
        relevance = max(0.0, min(1.0, 1.0 - float(dist)))
        if relevance < min_relevance:
            continue
        # Small-to-big retrieval: the chunk was only used to *find* the right
        # section — what reaches the model and the UI is the complete parent
        # section, so a split fragment can never surface as partial evidence.
        full_text = meta.get("parent_section") or chunk or ""
        if full_text in seen_sections:
            continue
        seen_sections.add(full_text)
        sources.append({
            "id": f"src-{i + 1}",
            "title": Path(filename).stem if filename else "knowledge",
            "section": f"chunk {meta.get('chunk', i)}",
            "relevanceScore": round(relevance, 2),
            "excerpt": full_text,
            # Full parent-section evidence for prompt grounding; a table must
            # reach the model intact, never as a header-less row fragment.
            "content": full_text,
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

def _chunk_text(text: str) -> list[tuple[str, str]]:
    """Split Markdown by section into (chunk, parent_section) pairs.

    Character slicing makes a table row lose its header or splits a row in
    half. Most SOP sections fit within the chunk budget, so keep each one
    atomic; only split oversized sections at complete line boundaries. Every
    chunk carries its full parent section so retrieval can return complete
    context instead of a truncated fragment.
    """
    sections = re.split(r"(?m)(?=^#{1,3}\s+)", text)
    pairs: list[tuple[str, str]] = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(section) <= _CHUNK_SIZE:
            pairs.append((section, section))
        else:
            pairs.extend((chunk, section) for chunk in _split_preserving_lines(section))
    return pairs


def _split_preserving_lines(section: str) -> list[str]:
    """Split an oversized section at line boundaries with line-safe overlap.

    Tables are split by row with the header and separator re-attached to every
    fragment, so no data row ever loses the column labels that give it meaning.
    """
    lines = section.splitlines()
    table_start = next(
        (i for i, line in enumerate(lines) if line.strip().startswith("|")), None
    )
    if (
        table_start is not None
        and table_start + 1 < len(lines)
        and _is_table_separator(lines[table_start + 1])
    ):
        return _split_table_aware(lines, table_start)

    chunks: list[str] = []
    current: list[str] = []
    current_size = 0

    for line in lines:
        line_size = len(line) + 1
        if current and current_size + line_size > _CHUNK_SIZE:
            chunks.append("\n".join(current).strip())

            overlap: list[str] = []
            overlap_size = 0
            for previous_line in reversed(current):
                size = len(previous_line) + 1
                if overlap and overlap_size + size > _CHUNK_OVERLAP:
                    break
                overlap.insert(0, previous_line)
                overlap_size += size
            current = overlap
            current_size = overlap_size

        current.append(line)
        current_size += line_size

    if current:
        chunks.append("\n".join(current).strip())
    return [chunk for chunk in chunks if chunk]


def _is_table_separator(line: str) -> bool:
    """Whether *line* is a Markdown table separator row like |---|---|---|."""
    stripped = line.strip()
    return bool(stripped) and "-" in stripped and all(c in "|-: " for c in stripped)


def _split_table_aware(lines: list[str], table_start: int) -> list[str]:
    """Split an oversized section at table row boundaries.

    Every fragment keeps the section preamble, the table header and its
    separator row, so a chunk holding only a slice of data rows still carries
    the column labels that give those rows meaning.
    """
    prefix_lines = lines[:table_start] + [lines[table_start]]
    if table_start + 1 < len(lines):
        prefix_lines.append(lines[table_start + 1])
    prefix = "\n".join(prefix_lines)

    chunks: list[str] = []
    current_rows: list[str] = []
    for row in lines[table_start + 2:]:
        current_rows.append(row)
        candidate = "\n".join([prefix] + current_rows)
        if len(candidate) > _CHUNK_SIZE:
            current_rows.pop()  # this row pushed it over — close out without it
            if current_rows:
                chunks.append("\n".join([prefix] + current_rows).strip())
            current_rows = [row]  # start the next fragment with the overflowing row

    if current_rows:
        chunks.append("\n".join([prefix] + current_rows).strip())
    return [chunk for chunk in chunks if chunk]
