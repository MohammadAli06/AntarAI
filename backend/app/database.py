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
    create_engine,
    func,
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
    generated_file = Column(String, nullable=True)    # generated output filename
    status = Column(String, default="pending_approval") # draft / pending_approval / approved / rejected
    timestamp = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=True)         # pdf / image / etc.
    size_bytes = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, nullable=True)      # user_id
    indexed = Column(String, default="pending")       # pending / indexed / failed
    upload_date = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """Create all tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
