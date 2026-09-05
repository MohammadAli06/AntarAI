# Sovereign AI Workbench Backend

FastAPI backend for **AntarAI — the final SIH PS 26117 solution for MRPL**, a Sovereign On-Premise Agentic AI Workbench for confidential industrial work.

Local APIs for streaming agentic execution, model routing, uploads, sovereignty proof, authentication, task history, approvals, and governance — all on-premise.

## Stack

- Python 3.11+
- FastAPI + Uvicorn + Pydantic
- SQLAlchemy + SQLite (`backend/users.db`)
- bcrypt + python-jose (HS256 JWT, 8h / 2h demo)
- PyYAML
- python-docx, openpyxl, python-pptx
- ChromaDB + sentence-transformers (`all-MiniLM-L6-v2`) for local RAG
- psutil for measured sovereignty
- Tesseract (optional) for on-device OCR

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks activation:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Initialize demo users

Startup creates tables and seeds users when `users` is empty. You can also run explicitly:

```bash
python seed.py
```

| Username | Password | Role |
| --- | --- | --- |
| `engineer1` | `demo1234` | engineer |
| `approver1` | `demo1234` | approver |
| `admin1` | `admin1234` | admin |

## Run the API

From `backend/` so imports and `models.yaml`/`policies.yaml` resolve:

```bash
python -m uvicorn app.main:app --reload --port 8000
# also seed the local knowledge corpus on first run (backend/data/seed/*.md → ChromaDB)
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Health: `curl http://localhost:8000/`

## Authentication

`POST /auth/login` is public. Everything else requires `Authorization: Bearer <JWT>` (8h normal, 2h demo-scoped). Role is the **signed token's `role` claim** (`Principal`), so `require_role()` is authoritative.

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"engineer1","password":"demo1234"}'
# → { access_token, token_type, username, role }

curl http://localhost:8000/models \
  -H "Authorization: Bearer <access_token>"
```

Demo role switching (final-round demo, `DEMO_MODE=1` default) re-issues a short-lived demo token without mutating `users.role`:

```bash
curl -X POST http://localhost:8000/demo/switch-role \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

Authoritative view: `GET /me` → `{ username, role, demo, demoMode }`.

Production secret:

```powershell
$env:JWT_SECRET_KEY = "replace-with-a-long-random-secret"
```

## API routes

### Public

- `GET /` — health.
- `POST /auth/login` — authenticate and return a JWT.

### Protected

- `POST /chat` — legacy single-shot (`multipart: message, file?`) → `{ response, model_used, steps, generated_file }`.
- `POST /chat/stream` — **streaming SSE** (`multipart: message, file?`) → `text/event-stream` (`task.created` → `router.*` → `ocr.*` → `knowledge.*` → `model.*` → `tool.*` → `verification.*` → `artifact.created` → `approval.required` → `task.completed`/`task.failed` + `stream.end`).
- `POST /upload` — store file → `Document(uploaded_by, indexed=pending)` → `extract_text()` → `ingest_document()` (ChromaDB) → `{ status, indexed, chunks_indexed }`.
- `GET /models` — registry with live `online`/`offline` per endpoint.
- `GET /outputs` — `{ outputs: [{ filename, size_bytes, download_url }] }`.
- `GET /outputs/{filename}` — download.
- `GET /sovereignty-status` — **measured** `{ external_calls (psutil), local_model_calls, local_files_accessed, blocked_attempts, local_services (probed), model_integrity (SHA-256/health), online, verdict }`.
- `GET /tasks/mine` — own tasks (20, `_task_to_dict` with verification + approval).
- `GET /tasks` (approver/admin, 50) / `GET /audit` (approver/admin, 50) — cross-user history and audit trail.
- `POST /tasks/{id}/approve` / `POST /tasks/{id}/reject` (approver/admin) — immutable approval record.
- `GET /me` / `POST /demo/switch-role` (DEMO_MODE).
- `GET /tools` — 6 live tool probes.
- `GET /users` (admin) / `GET /policies` (admin, `policies.yaml`) / `GET /documents` / `DELETE /knowledge-base/{doc_id}` (admin).

## Agent pipeline

`app/agent/orchestrator.py` — `run_agent_stream()` is the single source of truth (generator of SSE dicts); `run_agent()` replays it for `POST /chat`.

1. `task.created`
2. `router.started/completed` — `classify_task()` → `get_model_for_role()` → `modelRoute` card payload
3. `ocr.started/completed` — Tesseract when a file is present
4. `knowledge.started/completed` — `retrieve_sources()` (ChromaDB, 3 hits, `EvidenceSource[]`). The query is expanded with the prior user turn (`_rag_query`) so follow-ups retrieve meaningfully.
5. Prompt assembled (role system preamble + role-tagged conversation history + file name + extracted text + RAG context → ChatML)
6. `model.started/completed` — `call_model(role, prompt, n_predict=2048 for coder else 512)` to llama.cpp
7. Vision field extraction + doc generation (`generate_approval_note`) / sandbox (`run_code_sandbox`)
8. `verification.started/completed` — `verify_artifact()` (re-execution / doc-structure + `sha256_file()`)
9. `artifact.created` — `sha256` + `downloadUrl`
10. `approval.required` (when `generated_file` and not `coder`) → `task.completed`/`task.failed`

`backend/app/main.py` creates the `Task` row upfront (`planning`→`running`→`verifying`→`completed`/`pending_approval`/`failed`) and persists `risk`/`evidence_count`/`artifact_sha256`/`model_run_id`/`verification_json`/`approved_by`/`approved_at` via `_persist_task_update()`.

## Model registry

`models.yaml`:

```yaml
general: Qwen3-8B
coder: Qwen3-Coder
vision: Qwen3-VL
```

All three map to `http://127.0.0.1:8081/completion` today (same `Qwen3-8B-Q4_K_M` weights, role-specific prompting). Add a dedicated model by editing `models.yaml` — no code change; VRAM is the only constraint. `list_models()` probes `GET /health` per base URL.

## Storage locations

- SQLite: `backend/users.db` (+ non-destructive `ALTER TABLE` migration for provenance columns)
- Uploads: `backend/data/documents/` , `backend/data/images/`
- Vector index: `backend/data/chroma/` (`mrpl_documents`)
- Seed corpus: `backend/data/seed/` (ingested on startup if empty)
- Outputs: `backend/outputs/` (also where `solution_*.py` artifacts live)
- Config: `backend/models.yaml`, `backend/policies.yaml`

## Frontend connection

`http://localhost:5173` → `http://localhost:8000` (CORS permissive for local dev). The dashboard attaches the JWT, consumes `POST /chat/stream` via `fetch` + `ReadableStream`, and renders every SSE stage live. Set `VITE_API_URL` when the API is hosted elsewhere.

## Security posture

This is the SIH final solution — air-gapped by design. Before production:

- Set `JWT_SECRET_KEY` via a deployment secret.
- Restrict CORS to the deployed origin.
- Keep upload validation (names, sizes, MIME) at the API boundary.
- Preserve the sandbox jail (cwd jail, dropped env, `sitecustomize` network shim, `RLIMIT_CPU`/`RLIMIT_AS` on POSIX, 10s timeout); add a container boundary per site policy.
- Filesystem-protect `users.db`, `backend/data/chroma/`, uploads, and `backend/outputs/`.
- Set `ANTARAI_MODEL_FILE` + `ANTARAI_MODEL_SHA256` for real weight integrity.
- Treat a non-zero `external_calls` from `GET /sovereignty-status` as a violation.
