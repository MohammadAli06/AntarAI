"""
Database — SQLAlchemy setup with SQLite.

Three tables:
  users     — auth, provisioned accounts only
  tasks     — agent task history (feeds dashboard)
  documents — uploaded file tracking (embeddings stay in ChromaDB)
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    func,
    inspect,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# SQLite file lives at backend/users.db
_DB_PATH = Path(__file__).resolve().parents[1] / "users.db"
DATABASE_URL = f"sqlite:///{_DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# ORM base & models
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="engineer", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    task_type = Column(String, nullable=False)        # general / coder / vision
    model_used = Column(String, nullable=False)
    prompt_preview = Column(String, nullable=True)    # first 120 chars of message
    prompt_text = Column(Text, nullable=True)
    input_filename = Column(String, nullable=True)
    final_output = Column(Text, nullable=True)
    generated_file = Column(String, nullable=True)    # generated output filename
    status = Column(String, default="pending_approval") # draft / pending_approval / approved / rejected
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Provenance + verification (added by non-destructive migration)
    risk = Column(String, nullable=True)             # low / medium / high / critical
    evidence_count = Column(Integer, nullable=True)
    artifact_sha256 = Column(String, nullable=True)
    model_run_id = Column(String, nullable=True)
    verification_json = Column(Text, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=True)         # pdf / image / etc.
    size_bytes = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, nullable=True)      # user_id
    indexed = Column(String, default="pending")       # pending / indexed / failed
    content_hash = Column(String, nullable=True, index=True)
    stored_filename = Column(String, nullable=True)   # collision-safe name on disk
    chunks_indexed = Column(Integer, nullable=True)
    failure_reason = Column(Text, nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """Create all tables if they don't already exist, then add any new
    provenance/verification columns to the tasks table via ALTER TABLE
    (non-destructive — preserves existing rows)."""
    Base.metadata.create_all(bind=engine)
    _migrate_task_columns()
    _migrate_document_columns()


def _migrate_task_columns() -> None:
    """Add new nullable columns to an existing tasks table in place.

    create_all won't alter an existing table, so we ALTER missing columns.
    All new columns are nullable so old rows and old code keep working.
    """
    try:
        insp = inspect(engine)
        if not insp.has_table("tasks"):
            return
        existing = {c["name"] for c in insp.get_columns("tasks")}
        # (column_name, sqlite_type)
        additions = [
            ("risk", "TEXT"),
            ("evidence_count", "INTEGER"),
            ("artifact_sha256", "TEXT"),
            ("model_run_id", "TEXT"),
            ("verification_json", "TEXT"),
            ("approved_by", "TEXT"),
            ("approved_at", "DATETIME"),
            ("prompt_text", "TEXT"),
            ("input_filename", "TEXT"),
            ("final_output", "TEXT"),
        ]
        with engine.begin() as conn:
            from sqlalchemy import text
            for col, col_type in additions:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col} {col_type}"))
    except Exception:
        # Best-effort migration — don't crash startup.
        pass


def _migrate_document_columns() -> None:
    """Add Knowledge Base lifecycle fields without discarding existing rows."""
    try:
        insp = inspect(engine)
        if not insp.has_table("documents"):
            return
        existing = {c["name"] for c in insp.get_columns("documents")}
        additions = [
            ("content_hash", "TEXT"),
            ("stored_filename", "TEXT"),
            ("chunks_indexed", "INTEGER"),
            ("failure_reason", "TEXT"),
        ]
        with engine.begin() as conn:
            from sqlalchemy import text
            for col, col_type in additions:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col} {col_type}"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_documents_content_hash "
                "ON documents (content_hash)"
            ))
    except Exception:
        # Best-effort migration; startup must remain available for diagnostics.
        pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
