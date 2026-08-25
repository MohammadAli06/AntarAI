# Sovereign AI Workbench

**AntarAI** is a Sovereign On-Premise Agentic AI Workbench for confidential industrial work. It is being developed for Smart India Hackathon problem statement **PS 26117**, focused on MRPL (Mangalore Refinery and Petrochemicals Ltd).

The workbench gives refinery engineers a local AI assistant for document analysis, coding, OCR/vision workflows, and operational knowledge work without sending confidential refinery data to external cloud services.

## What problem it solves

Industrial teams work with sensitive documents, maintenance records, process information, code, and engineering drawings. General-purpose cloud AI tools can create data-governance, confidentiality, and network-isolation concerns.

AntarAI solves this by keeping the complete agent workflow on the local network:

- Routes tasks to local open-weight model roles.
- Accepts confidential documents and images for analysis.
- Provides an agent activity trace showing classification, model selection, and execution steps.
- Generates local output artifacts such as Word reports.
- Records local model calls, file access, and task history.
- Provides a sovereignty monitor to show that no external API calls were made.
- Supports role-based access using local JWT authentication.

## Current prototype capabilities

- Local general reasoning, coding, and vision model routing.
- Multipart chat requests with optional PDF/image attachments.
- Mock model responses for end-to-end demonstration before llama.cpp is connected.
- PDF/image upload storage under the backend data directory.
- Generated output listing and downloads.
- Local SQLite database for users, task history, and uploaded documents.
- JWT login with engineer, approver, and admin roles.
- React + Tailwind operator dashboard with:
  - Workspace
  - Knowledge Base placeholder
  - Sovereignty Monitor
  - Models registry

## Architecture

```text
frontend/                 React + TypeScript + Vite + Tailwind dashboard
    |
    | HTTP / multipart requests
    v
backend/                  FastAPI local API
    |
    +-- Agent orchestrator: classify -> route -> model -> tools
    +-- Model registry: local model configuration and mock adapter
    +-- Tools: document generation and code sandbox
    +-- SQLite: users, tasks, uploaded documents
    +-- Local filesystem: input files and generated outputs
    |
models.yaml               Local model roles and localhost endpoints
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
│   │   └── tools/
│   ├── data/
│   │   ├── documents/
│   │   └── images/
│   ├── outputs/
│   ├── models.yaml
│   ├── requirements.txt
│   └── seed.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   └── views/
│   ├── package.json
│   └── README.md
├── data/                   # Reserved project-level data directories
├── models/                 # Place .gguf model files here when wired in
├── sandbox/                # Reserved sandbox workspace
└── docker/                 # Reserved container/deployment files
```

## Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- npm
- Optional: llama.cpp or another localhost model server when replacing mock responses

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

The API runs at `http://localhost:8000`.

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

The backend seeds these accounts when the database is empty:

| Username | Password | Role |
| --- | --- | --- |
| `engineer1` | `demo1234` | Engineer |
| `approver1` | `demo1234` | Approver |
| `admin1` | `admin1234` | Admin |

Login endpoint:

```http
POST /auth/login
Content-Type: application/json

{"username":"engineer1","password":"demo1234"}
```

Sensitive endpoints require the returned token:

```http
Authorization: Bearer <access_token>
```

> **Frontend integration note:** the current dashboard has the workspace views and API client in place, but it does not yet render a login screen or automatically attach a JWT. The current protected backend therefore returns `401 Authentication required` to those frontend requests until authentication wiring is added or the backend is configured for an unauthenticated demo mode.

## Backend API

### Public

- `GET /` - health and service status.
- `POST /auth/login` - issue an 8-hour JWT.

### Protected

- `POST /chat` - multipart form request with `message` and optional `file`.
- `POST /upload` - upload a PDF or image.
- `GET /outputs` - list generated files.
- `GET /outputs/{filename}` - download an output.
- `GET /models` - list configured local models.
- `GET /sovereignty-status` - return external calls, local model calls, and local file access counts.
- `GET /tasks/mine` - return task history for the current user.
- `GET /tasks` - list all tasks for approvers/admins.
- Approval routes in `backend/app/main.py` - manage generated document approval workflow.

The backend currently returns `/outputs` as `{ "outputs": [...] }` with `filename`, `size_bytes`, and `download_url`. The frontend normalizes this alongside the originally planned `{ "files": [...] }` shape.

## Models

`backend/models.yaml` currently registers three local roles:

- `general` -> `Qwen3-8B`
- `coder` -> `Qwen3-Coder`
- `vision` -> `Qwen3-VL`

The model registry currently returns mock responses. The intended next integration is a localhost llama.cpp completion endpoint, using the endpoints configured in `models.yaml`. No external model provider is required for the current prototype.

## Local data and generated files

- Users and task/document metadata: `backend/users.db`
- Uploaded PDFs: `backend/data/documents/`
- Uploaded images: `backend/data/images/`
- Generated files: `backend/outputs/`
- Model weights: reserved `models/` directory

These paths contain confidential or generated artifacts and should be excluded from source control in a production deployment.

## Development notes

- Backend CORS is currently permissive for local frontend development.
- The frontend defaults to `http://localhost:8000`; set `VITE_API_URL` when the API is hosted elsewhere.
- The frontend uses actual FastAPI multipart `/chat` requests, not JSON bodies.
- Knowledge Base records are static/mock data for the prototype and are labeled in the UI.
- OCR, vector retrieval, and real model inference remain integration points for the next phase.

## Intended security posture

The architecture is designed for on-premise and air-gapped deployment, but the current hackathon prototype still requires production hardening before operational use:

- Set `JWT_SECRET_KEY` through a deployment secret instead of using the development fallback.
- Restrict CORS to the deployed frontend origin.
- Validate upload filenames and file sizes at the API boundary.
- Run the code sandbox with strong OS/container isolation.
- Protect generated files and database backups with appropriate filesystem permissions.
- Replace mock model calls with audited localhost inference services.

## License

This prototype does not currently declare a license. Add the appropriate project or organization license before public distribution.
