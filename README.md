# Sovereign AI Workbench

**AntarAI** is a Sovereign On-Premise Agentic AI Workbench for confidential industrial work. It is the **final solution for Smart India Hackathon PS 26117**, built for **MRPL (Mangalore Refinery and Petrochemicals Ltd)**.

The workbench gives refinery engineers a local AI assistant for document analysis, coding, OCR/vision workflows, and operational knowledge work — without sending confidential refinery data to external cloud services.

## What problem it solves

Industrial teams work with sensitive documents, maintenance records, process information, code, and engineering drawings. General-purpose cloud AI tools create data-governance, confidentiality, and network-isolation concerns.

AntarAI solves this by keeping the complete agent workflow on the local network:

- Routes tasks to local open-weight model roles (Qwen3-8B via llama.cpp).
- Accepts confidential documents and images for analysis.
- Streams the full agent pipeline over SSE (classify → OCR → RAG → model → tools → verification → artifact → approval).
- Generates local output artifacts such as Word reports and sandbox-tested Python.
- Verifies every artifact with real checks and SHA-256 integrity.
- Records local model calls, file access, and task history with human-in-the-loop approvals.
- Proves sovereignty with measured signals (psutil sockets, port probes, weight hash) — not assertions.
- Enforces role-based access with signed JWTs and server-verified demo switching.

## Final solution capabilities

- Local Qwen3-8B-Q4_K_M inference via llama.cpp on `127.0.0.1:8081` (no cloud fallback).
- Streaming `POST /chat/stream` (`text/event-stream`) with 12 staged events; legacy `POST /chat` reconstructed from the same generator.
- Multipart chat with optional PDF/image attachments; on-device OCR (Tesseract) when a file is present.
- Real ChromaDB retrieval (`all-MiniLM-L6-v2`, 500-char chunks, 50 overlap) with a seeded MRPL corpus (SOP-PUMP-042, manuals, standards, prior notes).
- Hardened Python sandbox (cwd jail, dropped env, `sitecustomize` network block, `RLIMIT_CPU`/`RLIMIT_AS` on POSIX, 10s timeout, artifact saved to `backend/outputs/`).
- Real artifact verification (re-execution + doc-structure + hash + confidence) and approval workflow.
- SQLite task/document history with provenance columns (`risk`, `evidence_count`, `artifact_sha256`, `model_run_id`, `verification_json`, `approved_by/approved_at`).
- JWT auth (8h, HS256, bcrypt, `Principal` role from signed token) + `DEMO_MODE` server-verified role switch (`POST /demo/switch-role`).
- Sovereignty monitor measured via `psutil` outbound sockets, TCP port probes, weight SHA-256 / health probe, and sandbox block counter.
- React + Tailwind workbench with role-aware sidebar, streaming workspace, knowledge base, approvals, and admin planes (Tools / Users / Policies).

## Architecture

```text
frontend/                 React + TypeScript + Vite + Tailwind dashboard
    |
    | HTTP / multipart + SSE (fetch + ReadableStream)
    v
backend/                  FastAPI local API
    |
    +-- Streaming orchestrator: run_agent_stream() → SSE events
    +-- Model registry: Qwen3-8B via llama.cpp (local HTTP)
    +-- Router: general / coder / vision classification
    +-- Tools: doc generator, hardened sandbox, OCR, verifier
    +-- RAG: ChromaDB (local embeddings, local retrieval)
    +-- Sovereignty inspector: psutil + port probes + SHA-256
    +-- SQLite: users, tasks, documents (+ provenance)
    +-- Local filesystem: inputs and generated outputs
    |
models.yaml               Local model roles and localhost endpoints
policies.yaml             Risk rules + approval thresholds + sovereignty policy
```

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── agent/
│   │   ├── models/
│   │   ├── router/
│   │   ├── tools/
│   │   ├── rag/
│   │   └── sovereignty/
│   ├── data/
│   │   ├── documents/
│   │   ├── images/
│   │   ├── chroma/
│   │   └── seed/              # MRPL seed corpus (ingested on startup)
│   ├── outputs/
│   ├── models.yaml
│   ├── policies.yaml
│   ├── requirements.txt
│   └── seed.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── views/
│   ├── package.json
│   └── README.md
├── data/
├── models/                    # Place .gguf weights here when wired in
├── sandbox/
└── docker/
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm
- llama.cpp `llama-server` for local inference (Qwen3-8B-Q4_K_M)
- Optional: Tesseract for on-device OCR

## Quick start

Open two terminals from the repository root.

### Terminal 1: backend

#### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --reload --port 8000
```

#### macOS/Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000` (`/docs` for Swagger).

### Model (local)

```bash
llama-server -m /path/to/Qwen3-8B-Q4_K_M.gguf --port 8081
# Optional for real weight verification:
# set ANTARAI_MODEL_FILE and ANTARAI_MODEL_SHA256
```

### Terminal 2: frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:5173`.

For a production bundle:

```bash
cd frontend
npm run build
npm run preview
```

## Demo accounts

Seeded when the database is empty:

| Username | Password | Role |
| --- | --- | --- |
| `engineer1` | `demo1234` | Engineer |
| `approver1` | `demo1234` | Approver |
| `admin1` | `admin1234` | Admin |

Login:

```http
POST /auth/login
Content-Type: application/json

{"username":"engineer1","password":"demo1234"}
```

All sensitive endpoints require:

```http
Authorization: Bearer <access_token>
```

The dashboard handles login, stores the JWT in `localStorage`, attaches it to every request, and redirects to Auth on 401. Role comes from the signed token; demo switching (`Role:` in the header) re-issues a demo-scoped JWT via `POST /demo/switch-role` and never mutates the DB row.

## Backend API

### Public

- `GET /` — health and service status.
- `POST /auth/login` — issue an 8-hour JWT.

### Protected (Bearer)

- `POST /chat` — legacy single-shot pipeline (`multipart: message, file?`).
- `POST /chat/stream` — streaming pipeline (`multipart: message, file?`) → `text/event-stream` (12 staged events).
- `POST /upload` — upload + OCR + ChromaDB ingestion.
- `GET /outputs` — list generated files.
- `GET /outputs/{filename}` — download.
- `GET /models` — model registry with live `online`/`offline`.
- `GET /sovereignty-status` — measured `{ external_calls, local_model_calls, local_files_accessed, blocked_attempts, local_services, model_integrity, online, verdict }`.
- `GET /tasks/mine` — own task history.
- `GET /tasks` — all tasks (approver/admin).
- `GET /audit` — audit trail (approver/admin).
- `POST /tasks/{id}/approve` / `POST /tasks/{id}/reject` — human-in-the-loop gate.
- `GET /me` — authoritative `{ username, role, demo, demoMode }`.
- `POST /demo/switch-role` — demo-scoped role switch (DEMO_MODE-gated).
- `GET /tools` — tool availability probes.
- `GET /users` (admin) / `GET /policies` (admin) / `GET /documents` / `DELETE /knowledge-base/{id}` (admin).

`GET /outputs` returns `{ "outputs": [...] }` with `filename`, `size_bytes`, `download_url`; the frontend normalizes both `snake_case` and `camelCase`.

## Models

`backend/models.yaml` registers:

- `general` → `Qwen3-8B`
- `coder` → `Qwen3-Coder`
- `vision` → `Qwen3-VL`

All three currently resolve to the same local `Qwen3-8B-Q4_K_M` on `http://127.0.0.1:8081/completion` (role-differentiated prompting); adding a dedicated model is a one-line `models.yaml` change — no code change — with VRAM as the only constraint.

## Local data and generated files

- Users / tasks / documents: `backend/users.db` (SQLite)
- Uploaded PDFs / images: `backend/data/documents/` , `backend/data/images/`
- Vector index: `backend/data/chroma/` (ChromaDB, `mrpl_documents`)
- Seed corpus: `backend/data/seed/` (ingested on startup if empty)
- Generated files: `backend/outputs/`
- Model weights: `models/` + `ANTARAI_MODEL_FILE`

## Development notes

- CORS is permissive for local development; restrict `allow_origins` before deployment.
- Frontend defaults to `http://localhost:8000`; set `VITE_API_URL` when the API is hosted elsewhere.
- `src/lib/api.ts` is the single API surface; `src/lib/mockData.ts` now only supplies the six workflow starter prompts.
- `npm run build` typechecks and produces the Vite bundle.

## Security posture

This is the SIH final solution — on-premise, air-gapped by design. Before production deployment still ensure:

- Set `JWT_SECRET_KEY` via a deployment secret (do not ship the dev fallback).
- Restrict CORS to the deployed frontend origin.
- Keep upload validation (filenames, sizes, MIME) at the API boundary.
- Run the sandbox with the documented OS isolation (cwd jail, dropped env, network shim, rlimits); consider an additional container boundary per your site policy.
- Protect `users.db`, `backend/data/chroma/`, uploads, and `backend/outputs/` with filesystem permissions.
- Set `ANTARAI_MODEL_FILE` + `ANTARAI_MODEL_SHA256` for real weight integrity.
- The sovereignty monitor measures — treat a non-zero `external_calls` as a violation.

## License

No license is declared yet. Add the appropriate project or organization license before distribution.
