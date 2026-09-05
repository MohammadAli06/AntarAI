"""
Database — SQLAlchemy setup with SQLite.

Tables:
  users         — auth, provisioned accounts only
  tasks         — agent task history (feeds dashboard + approvals)
  documents     — uploaded file tracking (embeddings stay in ChromaDB)
  conversations — per-user conversation threads (owner = user_id, enforced server-side)
  messages      — ordered messages inside a conversation (user/assistant/tool)
  attachments   — file refs bound to a conversation + optional message
  task_access   — governed sharing: approver/admin visibility on another user's task
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
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
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, index=True)
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


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="New conversation")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    archived = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user | assistant | tool
    content = Column(Text, nullable=False, default="")
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True, index=True)
    file_path = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TaskAccess(Base):
    __tablename__ = "task_access"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    access_type = Column(String, nullable=False, default="review")  # review | approval
    granted_at = Column(DateTime, default=datetime.utcnow)


class ModelAdmission(Base):
    """Immutable record of every model admitted through the Model Center."""

    __tablename__ = "model_admissions"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, nullable=False)
    catalog_key = Column(String, nullable=True)
    source = Column(String, nullable=False, default="local")  # catalog | local | offline-package
    role = Column(String, nullable=False)
    sha256 = Column(String, nullable=False, index=True)
    node = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    checks_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    admitted_by = Column(String, nullable=False, default="admin")
    admitted_at = Column(DateTime, default=datetime.utcnow, index=True)


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
    _migrate_conversation_tables()


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


def _migrate_conversation_tables() -> None:
    """Ensure conversation-scoped tables/columns exist for older DBs."""
    try:
        insp = inspect(engine)
        if insp.has_table("tasks"):
            existing = {c["name"] for c in insp.get_columns("tasks")}
            if "conversation_id" not in existing:
                with engine.begin() as conn:
                    from sqlalchemy import text as _text
                    conn.execute(_text("ALTER TABLE tasks ADD COLUMN conversation_id INTEGER"))
                    conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_tasks_conversation_id ON tasks (conversation_id)"))
    except Exception:
        pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
