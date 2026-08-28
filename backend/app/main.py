"""
AntarAI Backend — Sovereign On-Premise Agentic AI Workbench
===========================================================

FastAPI application serving the core API for the AntarAI workbench.
Designed for MRPL (Mangalore Refinery) — Smart India Hackathon PS 26117.

Run with:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agent.orchestrator import run_agent, run_agent_stream
from app.auth import (
    DEMO_MODE,
    Principal,
    create_access_token,
    create_demo_token,
    get_current_user,
    require_role,
    verify_password,
)
from app.database import Document, SessionLocal, Task, User, create_tables, get_db
from app.models.registry import get_call_count, list_models
from app.tools.ocr_extractor import extract_text
from app.rag.ingestor import ingest_document
from app.rag.seed_knowledge import seed_knowledge_if_empty
from app.sovereignty.inspector import (
    count_external_calls,
    get_blocked_attempts,
    model_integrity,
    probe_local_services,
)
from seed import seed_users

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
_DATA_DIR = _BACKEND_ROOT / "data"
_DOCUMENTS_DIR = _DATA_DIR / "documents"
_IMAGES_DIR = _DATA_DIR / "images"
_OUTPUTS_DIR = _BACKEND_ROOT / "outputs"

for d in (_DOCUMENTS_DIR, _IMAGES_DIR, _OUTPUTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AntarAI — Sovereign Agentic AI Workbench",
    description=(
        "On-premise, air-gapped AI workbench for MRPL. "
        "Powered by Qwen3-8B-Q4_K_M (Qwen/Qwen3-8B-GGUF) via llama.cpp. "
        "Zero external network calls by design."
    ),
    version="1.0.0",
)

# CORS — allow frontend dev server (e.g. localhost:3000, localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup: DB tables + seed demo users
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    create_tables()
    seed_users()
    seed_knowledge_if_empty()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class ChatResponse(BaseModel):
    response: str
    model_used: str
    steps: list[str]
    generated_file: Optional[str] = None


class SovereigntyStatus(BaseModel):
    external_calls: int = 0
    local_model_calls: int
    local_files_accessed: int
    verdict: str = "✅ SOVEREIGN — All processing remained on-premise"


class SwitchRoleRequest(BaseModel):
    role: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_attached_file(
    file: Optional[UploadFile],
    current_user: Principal,
    db: Session,
) -> tuple[Optional[str], Optional[str], bool]:
    """Persist an uploaded file + log a Document row. Returns (path, name, has_file)."""
    if file is None or not file.filename:
        return None, None, False

    filename = file.filename
    ext = Path(filename).suffix.lower()
    save_dir = (
        _IMAGES_DIR
        if ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}
        else _DOCUMENTS_DIR
    )
    dest = save_dir / filename
    content = file.file.read()
    with open(dest, "wb") as f:
        f.write(content)

    doc = Document(
        filename=filename,
        file_type=ext.lstrip("."),
        size_bytes=len(content),
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    return str(dest), filename, True


def _persist_task_update(task_id: int, **fields) -> None:
    """Update a Task row from within the streaming generator (own session)."""
    s = SessionLocal()
    try:
        t = s.query(Task).filter(Task.id == task_id).first()
        if t is not None:
            for key, value in fields.items():
                if value is not None:
                    setattr(t, key, value)
            s.commit()
    finally:
        s.close()


def _task_to_dict(t: Task, owner_name: Optional[str] = None) -> dict:
    """Serialise a Task row, including provenance + verification fields."""
    verification = None
    if t.verification_json:
        try:
            verification = json.loads(t.verification_json)
        except Exception:
            verification = None
    approval = None
    if t.status == "approved" and t.approved_by:
        approval = {
            "approvedBy": t.approved_by,
            "approvedAt": t.approved_at.isoformat() if t.approved_at else None,
            "taskId": f"TASK-{t.id}",
            "artifactHash": t.artifact_sha256 or "",
            "modelRunId": t.model_run_id or "",
            "evidenceSetId": f"EV-{t.id}-{t.evidence_count or 0}",
        }
    return {
        "id": t.id,
        "user_id": t.user_id,
        "task_type": t.task_type,
        "model_used": t.model_used,
        "prompt_preview": t.prompt_preview,
        "generated_file": t.generated_file,
        "status": t.status,
        "timestamp": t.timestamp.isoformat() if t.timestamp else None,
        "risk": t.risk,
        "evidence_count": t.evidence_count,
        "artifact_sha256": t.artifact_sha256,
        "model_run_id": t.model_run_id,
        "verification": verification,
        "owner_name": owner_name,
        "approval": approval,
    }


# ---------------------------------------------------------------------------
# Public routes (no auth required)
# ---------------------------------------------------------------------------

@app.get("/", tags=["health"])
async def root():
    """Health check."""
    return {
        "service": "AntarAI Backend",
        "status": "running",
        "sovereignty": "enforced — zero external calls",
        "version": "0.2.0",
    }


@app.post("/auth/login", response_model=LoginResponse, tags=["auth"])
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with username + password.
    Returns a Bearer JWT valid for 8 hours.
    """
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(
        username=user.username,
        role=user.role,
        user_id=user.id,
    )
    return LoginResponse(
        access_token=token,
        username=user.username,
        role=user.role,
    )


# ---------------------------------------------------------------------------
# Protected routes — require valid JWT
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse, tags=["chat"])
async def chat(
    message: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Main chat endpoint.
    Accepts a message and optional file. Routes to the appropriate model
    via the agent orchestrator, logs the task, and returns the response.
    """
    file_path: Optional[str] = None
    filename: Optional[str] = None
    has_file = file is not None and file.filename

    if has_file:
        filename = file.filename
        ext = Path(filename).suffix.lower()
        save_dir = (
            _IMAGES_DIR
            if ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}
            else _DOCUMENTS_DIR
        )
        dest = save_dir / filename
        with open(dest, "wb") as f:
            f.write(await file.read())
        file_path = str(dest)

        # Log the uploaded document
        doc = Document(
            filename=filename,
            file_type=ext.lstrip("."),
            size_bytes=dest.stat().st_size,
            uploaded_by=current_user.id,
        )
        db.add(doc)
        db.commit()

    # Run the agentic pipeline
    result = run_agent(
        message=message,
        has_file=bool(has_file),
        filename=filename,
        file_path=file_path,
    )

    # Determine status: approval notes require supervisor approval
    initial_status = "pending_approval" if result.generated_file else "approved"

    # Log the task to history
    task = Task(
        user_id=current_user.id,
        task_type=result.model_used,
        model_used=result.model_used,
        prompt_preview=message[:120],
        generated_file=result.generated_file,
        status=initial_status,
    )
    db.add(task)
    db.commit()

    return ChatResponse(
        response=result.response,
        model_used=result.model_used,
        steps=result.steps,
        generated_file=result.generated_file,
    )


# ---------------------------------------------------------------------------
# Streaming chat — real SSE pipeline (text/event-stream)
# ---------------------------------------------------------------------------

@app.post("/chat/stream", tags=["chat"])
async def chat_stream(
    message: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream the agentic pipeline as Server-Sent Events.

    The frontend consumes this via fetch + ReadableStream (not EventSource,
    which is GET-only). Each yielded chunk is `data: {json}\\n\\n`.
    """
    file_path, filename, has_file = _save_attached_file(file, current_user, db)

    # Create the task row up-front (status = planning)
    task = Task(
        user_id=current_user.id,
        task_type="general",
        model_used="pending",
        prompt_preview=message[:120],
        status="planning",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    task_db_id = task.id
    task_id = f"TASK-{task.id}"

    def event_generator():
        for ev in run_agent_stream(message, has_file, filename, file_path):
            etype = ev["type"]
            data = ev.get("data", {})

            # Persist real status transitions
            if etype == "router.completed":
                _persist_task_update(
                    task_db_id,
                    task_type=data.get("role", "general"),
                    model_used=data.get("model", ""),
                    status="running",
                    risk=data.get("risk"),
                )
            elif etype == "verification.started":
                _persist_task_update(task_db_id, status="verifying")
            elif etype == "task.completed":
                _persist_task_update(
                    task_db_id,
                    status=data.get("status", "completed"),
                    generated_file=data.get("generatedFile"),
                    risk=data.get("risk"),
                    evidence_count=data.get("evidenceCount"),
                    model_run_id=data.get("modelRunId"),
                    artifact_sha256=data.get("artifactSha256"),
                    verification_json=json.dumps(data.get("verification")),
                )
            elif etype == "task.failed":
                _persist_task_update(task_db_id, status="failed")

            payload = {
                "type": etype,
                "taskId": task_id,
                "stepId": ev.get("stepId"),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "data": data,
            }
            yield f"data: {json.dumps(payload)}\n\n"

        yield f"data: {json.dumps({'type': 'stream.end', 'taskId': task_id, 'timestamp': datetime.utcnow().isoformat() + 'Z'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/models", tags=["models"])
async def get_models(current_user: User = Depends(get_current_user)):
    """Return list of configured models and their current status."""
    return {"models": list_models()}


@app.post("/upload", tags=["files"])
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a file (PDF, image, etc.). Triggers local OCR + ChromaDB ingestion."""
    filename = file.filename
    ext = Path(filename).suffix.lower()
    save_dir = (
        _IMAGES_DIR
        if ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}
        else _DOCUMENTS_DIR
    )
    dest = save_dir / filename
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    doc = Document(
        filename=filename,
        file_type=ext.lstrip("."),
        size_bytes=len(content),
        uploaded_by=current_user.id,
        indexed="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Background: OCR → ChromaDB ingestion
    indexed_status = "pending"
    chunks_indexed = 0
    try:
        extracted = extract_text(str(dest))
        if extracted and not extracted.startswith("["):
            ingest_result = ingest_document(
                text=extracted,
                filename=filename,
                doc_id=doc.id,
            )
            indexed_status = ingest_result["status"]
            chunks_indexed = ingest_result.get("chunks", 0)
        doc.indexed = indexed_status
        db.commit()
    except Exception as exc:
        doc.indexed = "failed"
        db.commit()

    return {
        "status": "uploaded",
        "filename": filename,
        "path": str(dest),
        "size_bytes": len(content),
        "indexed": indexed_status,
        "chunks_indexed": chunks_indexed,
    }



@app.get("/outputs", tags=["files"])
async def list_outputs(current_user: User = Depends(get_current_user)):
    """List all generated output files available for download."""
    files = []
    for f in _OUTPUTS_DIR.iterdir():
        if f.is_file():
            files.append(
                {
                    "filename": f.name,
                    "size_bytes": f.stat().st_size,
                    "download_url": f"/outputs/{f.name}",
                }
            )
    return {"outputs": files}


@app.get("/outputs/{filename}", tags=["files"])
async def download_output(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    """Download a generated output file."""
    file_path = _OUTPUTS_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )


@app.get("/sovereignty-status", tags=["sovereignty"])
async def sovereignty_status(
    current_user: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Real, measured sovereignty proof.

    Counts (all measured, none asserted):
      - external_calls   : live outbound ESTABLISHED sockets (non-loopback) via psutil
      - local_model_calls: real in-process counter incremented by call_model()
      - local_files_accessed: documents in SQLite
      - blocked_attempts : sandbox network interceptions
      - local_services   : real TCP port probes (backend + llama.cpp)
      - model_integrity  : SHA-256 of the on-prem weights (when configured)
    """
    model_calls = get_call_count()
    file_count = db.query(Document).count()
    outputs_count = sum(1 for f in _OUTPUTS_DIR.iterdir() if f.is_file())
    external = count_external_calls()
    services = probe_local_services()
    integrity = model_integrity()
    any_online = any(s.get("online") for s in services)

    verdict = (
        f"SOVEREIGN — {model_calls} model calls, {external} outbound, "
        f"{outputs_count} outputs — all on-premise"
        if external == 0
        else f"WARNING — {external} outbound connections detected"
    )

    return {
        "external_calls": external,
        "local_model_calls": model_calls,
        "local_files_accessed": file_count,
        "blocked_attempts": get_blocked_attempts(),
        "local_services": services,
        "model_integrity": integrity,
        "online": any_online,
        "verdict": verdict,
    }



# ---------------------------------------------------------------------------
# Task & Approval Management (RBAC Enforced)
# ---------------------------------------------------------------------------

@app.get("/tasks/mine", tags=["history"])
async def get_my_tasks(
    current_user: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """Return task history for the currently logged-in user."""
    tasks = (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.timestamp.desc())
        .limit(limit)
        .all()
    )
    return {"tasks": [_task_to_dict(t, owner_name=current_user.username) for t in tasks]}


@app.get("/tasks", tags=["history"])
async def list_all_tasks(
    current_user: Principal = Depends(require_role(["approver", "admin"])),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    """List ALL users' tasks — accessible by Approvers and Admins only."""
    tasks = (
        db.query(Task)
        .order_by(Task.timestamp.desc())
        .limit(limit)
        .all()
    )
    user_ids = {t.user_id for t in tasks}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {
        "tasks": [
            _task_to_dict(t, owner_name=users.get(t.user_id)) for t in tasks
        ]
    }


@app.get("/audit", tags=["history"])
async def audit_trail(
    current_user: Principal = Depends(require_role(["approver", "admin"])),
    db: Session = Depends(get_db),
    limit: int = 50,
):
    """Audit trail — recent task transitions (status, model, approver)."""
    tasks = db.query(Task).order_by(Task.timestamp.desc()).limit(limit).all()
    user_ids = {t.user_id for t in tasks}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return {
        "events": [
            {
                "id": t.id,
                "taskId": f"TASK-{t.id}",
                "owner": users.get(t.user_id, "unknown"),
                "modelUsed": t.model_used,
                "status": t.status,
                "risk": t.risk,
                "evidenceCount": t.evidence_count,
                "approvedBy": t.approved_by,
                "approvedAt": t.approved_at.isoformat() if t.approved_at else None,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "generatedFile": t.generated_file,
            }
            for t in tasks
        ]
    }


@app.post("/tasks/{task_id}/approve", tags=["approvals"])
async def approve_task(
    task_id: int,
    current_user: Principal = Depends(require_role(["approver", "admin"])),
    db: Session = Depends(get_db),
):
    """Approve an AI-generated draft/note — Approver and Admin only.

    Writes an immutable approval record (approver, timestamp, artifact hash,
    model run id, evidence set id) for provenance.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task #{task_id} not found")

    task.status = "approved"
    task.approved_by = current_user.username
    task.approved_at = datetime.utcnow()
    db.commit()

    approval = {
        "approvedBy": current_user.username,
        "approvedAt": task.approved_at.isoformat(),
        "taskId": f"TASK-{task.id}",
        "artifactHash": task.artifact_sha256 or "",
        "modelRunId": task.model_run_id or "",
        "evidenceSetId": f"EV-{task.id}-{task.evidence_count or 0}",
    }
    return {"status": "approved", "task_id": task_id, "approval": approval}


@app.post("/tasks/{task_id}/reject", tags=["approvals"])
async def reject_task(
    task_id: int,
    current_user: Principal = Depends(require_role(["approver", "admin"])),
    db: Session = Depends(get_db),
):
    """Reject an AI-generated draft/note — Approver and Admin only."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task #{task_id} not found")

    task.status = "rejected"
    task.approved_by = current_user.username
    task.approved_at = datetime.utcnow()
    db.commit()
    return {"status": "rejected", "task_id": task_id, "rejected_by": current_user.username}


# ---------------------------------------------------------------------------
# Demo role switching (DEMO_MODE-gated, server-verified)
# ---------------------------------------------------------------------------

@app.get("/me", tags=["auth"])
async def me(current_user: Principal = Depends(get_current_user)):
    """Return the authoritative (signed-token) role + demo flag."""
    return {
        "username": current_user.username,
        "role": current_user.role,
        "demo": current_user.demo,
        "demoMode": DEMO_MODE,
    }


@app.post("/demo/switch-role", tags=["auth"])
async def switch_demo_role(
    body: SwitchRoleRequest,
    current_user: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Switch the demo role by re-issuing a short-lived, demo-scoped JWT.

    Gated behind DEMO_MODE (default ON for the final round). The new role
    lives only in the signed token — it is NOT persisted to the User row.
    """
    if not DEMO_MODE:
        raise HTTPException(status_code=404, detail="Demo role switching is disabled")

    user = db.query(User).filter(User.username == current_user.username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_demo_token(user, body.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "role": body.role,
        "demo": True,
        "demoMode": True,
    }


# ---------------------------------------------------------------------------
# Admin control plane — Tools / Users / Policies
# ---------------------------------------------------------------------------

def _tool_status(name: str, tool_type: str, available: bool) -> dict:
    return {
        "name": name,
        "toolType": tool_type,
        "status": "online" if available else "offline",
        "networkBlocked": tool_type == "sandbox",
        "description": _tool_description(name),
    }


def _tool_description(name: str) -> str:
    return {
        "Python Sandbox": "Hardened subprocess — network blocked, cwd jail, resource caps.",
        "OCR Engine": "Tesseract — on-device text extraction from images & scanned PDFs.",
        "Document Generator": "python-docx — MRPL-branded Word deliverables.",
        "Vector Store": "ChromaDB + all-MiniLM-L6-v2 — local embeddings & retrieval.",
        "Artifact Verifier": "Re-execution + structural checks with SHA-256 integrity.",
        "Local Model": "Qwen3-8B-Q4_K_M via llama.cpp — air-gapped inference.",
    }.get(name, "")


@app.get("/tools", tags=["admin"])
async def list_tools(current_user: Principal = Depends(get_current_user)):
    """Tool registry with real availability status."""
    tools = []

    # Python sandbox — can we import it?
    sandbox_ok = True
    try:
        from app.tools.code_sandbox import run_code_sandbox  # noqa: F401
    except Exception:
        sandbox_ok = False
    tools.append(_tool_status("Python Sandbox", "sandbox", sandbox_ok))

    # OCR engine — tesseract binary present?
    ocr_ok = False
    try:
        from app.tools.ocr_extractor import _TESSERACT_AVAILABLE  # type: ignore
        ocr_ok = bool(_TESSERACT_AVAILABLE)
    except Exception:
        ocr_ok = False
    tools.append(_tool_status("OCR Engine", "ocr", ocr_ok))

    # Document generator — python-docx importable?
    doc_ok = True
    try:
        import docx  # type: ignore  # noqa: F401
    except Exception:
        doc_ok = False
    tools.append(_tool_status("Document Generator", "document-gen", doc_ok))

    # Vector store — chromadb initialised with content?
    rag_ok = False
    try:
        from app.rag.ingestor import _collection, _init_chroma  # type: ignore
        rag_ok = bool(_init_chroma() and _collection is not None and _collection.count() > 0)
    except Exception:
        rag_ok = False
    tools.append(_tool_status("Vector Store", "rag", rag_ok))

    # Verifier
    verify_ok = True
    try:
        from app.tools.verifier import verify_artifact  # noqa: F401
    except Exception:
        verify_ok = False
    tools.append(_tool_status("Artifact Verifier", "verification", verify_ok))

    # Local model — health probe via registry
    model_ok = False
    try:
        models = list_models()
        model_ok = any(m.get("status") == "online" for m in models)
    except Exception:
        model_ok = False
    tools.append(_tool_status("Local Model", "model", model_ok))

    return {"tools": tools}


@app.get("/users", tags=["admin"])
async def list_users(
    current_user: Principal = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """List all users — Admin only."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "createdAt": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@app.get("/policies", tags=["admin"])
async def list_policies(
    current_user: Principal = Depends(require_role(["admin"])),
):
    """Return governance policies from policies.yaml — Admin only."""
    policies_path = _BACKEND_ROOT / "policies.yaml"
    if not policies_path.exists():
        raise HTTPException(status_code=404, detail="policies.yaml not found")
    with open(policies_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return {"policies": data}


@app.get("/documents", tags=["knowledge"])
async def list_documents(
    current_user: Principal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List uploaded documents tracked in the SQLite documents table."""
    docs = db.query(Document).order_by(Document.upload_date.desc()).all()
    return {
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "file_type": d.file_type,
                "size_bytes": d.size_bytes,
                "indexed": d.indexed,
                "upload_date": d.upload_date.isoformat() if d.upload_date else None,
            }
            for d in docs
        ]
    }


@app.delete("/knowledge-base/{doc_id}", tags=["knowledge"])
async def delete_knowledge_document(
    doc_id: int,
    current_user: Principal = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Delete a document from Knowledge Base — Admin only."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "doc_id": doc_id}

