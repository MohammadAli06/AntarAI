# Sovereign AI Workbench Backend

This directory contains the FastAPI backend for AntarAI, a Sovereign On-Premise Agentic AI Workbench for confidential industrial work.

The backend exposes local APIs for agentic task execution, model routing, document/image uploads, generated outputs, sovereignty metrics, authentication, task history, and approval workflows.

## Stack

- Python 3.11+
- FastAPI
- Uvicorn
- Pydantic
- SQLAlchemy
- SQLite
- bcrypt
- python-jose JWT
- PyYAML
- python-docx, openpyxl, python-pptx

## Setup

From the repository root:

### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks activation, run the backend with the virtual environment interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### macOS/Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Initialize demo users

Startup automatically creates database tables and seeds users if the `users` table is empty. You can also run the seed script explicitly:

```bash
python seed.py
```

The demo accounts are:

| Username | Password | Role |
| --- | --- | --- |
| `engineer1` | `demo1234` | engineer |
| `approver1` | `demo1234` | approver |
| `admin1` | `admin1234` | admin |

## Run the API

Run from the `backend/` directory so imports and `models.yaml` resolve correctly:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`.

Interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Health check:

```bash
curl http://localhost:8000/
```

## Authentication

`POST /auth/login` is public. Sensitive routes require an 8-hour JWT Bearer token.

Request:

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"engineer1","password":"demo1234"}'
```

The response includes `access_token`, `token_type`, `username`, and `role`.

Use the token on protected routes:

```bash
curl http://localhost:8000/models \
  -H "Authorization: Bearer <access_token>"
```

Set a production secret before deployment:

```powershell
$env:JWT_SECRET_KEY = "replace-with-a-long-random-secret"
```

or:

```bash
export JWT_SECRET_KEY="replace-with-a-long-random-secret"
```

The code currently includes a development fallback secret for local demos. Do not use that fallback in production.

## API routes

### Public routes

- `GET /` - health check.
- `POST /auth/login` - authenticate a provisioned user and return a JWT.

### Protected routes

- `POST /chat`
  - Content type: `multipart/form-data`
  - Fields: `message` and optional `file`
  - Returns `response`, `model_used`, `steps`, and optional `generated_file`
- `POST /upload`
  - Content type: `multipart/form-data`
  - Field: `file`
  - Stores PDFs in `data/documents/` and images in `data/images/`
- `GET /models`
  - Returns configured model roles and status.
- `GET /outputs`
  - Returns generated files under the `outputs` key.
- `GET /outputs/{filename}`
  - Downloads a generated file.
- `GET /sovereignty-status`
  - Returns external calls, local model calls, local file access count, and a sovereignty verdict.
- `GET /tasks/mine`
  - Returns the authenticated user’s task history.
- `GET /tasks`
  - Lists all task history for approvers and admins.
- Approval routes in `app/main.py`
  - Used for supervisor approval and rejection of generated documents.

## Example chat request

```bash
curl -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer <access_token>" \
  -F "message=Summarise the current refinery safety observations"
```

With a file:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer <access_token>" \
  -F "message=Analyse this maintenance log" \
  -F "file=@../data/samples/maintenance-log.pdf"
```

## Agent pipeline

`app/agent/orchestrator.py` runs the current pipeline:

1. Classify the task as `general`, `coder`, or `vision`.
2. Select the matching model from the registry.
3. Add file context when a PDF/image is attached.
4. Call the model adapter.
5. Invoke document-generation or code-sandbox tools when matching keywords are present.
6. Return the response and ordered activity steps.

## Model registry

`models.yaml` currently defines:

```yaml
general: Qwen3-8B
coder: Qwen3-Coder
vision: Qwen3-VL
```

Each role points to a localhost completion endpoint at `http://localhost:8080/completion`. `app/models/registry.py` currently returns canned mock responses so the complete flow works without downloading model weights or running llama.cpp.

To connect real open-weight models, replace the implementation of `call_model()` in `app/models/registry.py` with an audited localhost inference call. Keep model traffic inside the local network.

## Storage locations

- SQLite database: `backend/users.db`
- Uploaded documents: `backend/data/documents/`
- Uploaded images: `backend/data/images/`
- Generated artifacts: `backend/outputs/`
- Model configuration: `backend/models.yaml`

## Frontend connection note

The frontend runs at `http://localhost:5173` and targets this API at `http://localhost:8000`. CORS is currently permissive for local development.

The current frontend does not yet provide a login screen or attach JWT tokens. As a result, protected requests from the dashboard return `401 Authentication required` until frontend authentication is implemented or the backend is temporarily run in an unauthenticated demo configuration.

## Security hardening before production

The current implementation is a hackathon prototype. Before operational use:

- Replace the JWT development fallback with a deployment secret.
- Restrict CORS to known frontend origins.
- Validate upload names, extensions, MIME types, and file sizes.
- Prevent path traversal when saving and downloading files.
- Isolate the code sandbox with OS/container controls and resource limits.
- Add structured audit logging and retention controls.
- Protect `users.db`, uploaded files, and generated outputs with filesystem permissions.
- Add rate limits and request size limits at the deployment boundary.
- Replace mock model responses with validated localhost inference services.
