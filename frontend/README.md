# Sovereign AI Workbench Frontend

React + TypeScript dashboard for **AntarAI — the final SIH PS 26117 solution for MRPL** (Sovereign On-Premise Agentic AI Workbench).

Operator console for task execution, streaming agent traces, grounded knowledge, sovereign proof, and governance — all backed by the local FastAPI + llama.cpp stack.

## Stack

- React 18 + TypeScript
- Vite + Tailwind CSS
- lucide-react
- Native `fetch` + `FormData` + `ReadableStream` (SSE via `fetch`, not `EventSource`)

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
npm run preview
```

## API configuration

Defaults to `http://localhost:8000`. Override with `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

Restart Vite after changing env vars.

## Views

### Workspace

The streaming agentic console — the flagship view:

- Prompt box + file picker/drag-drop + 6 workflow templates (prefilled prompts).
- `POST /chat/stream` (`multipart: message, file?` → `text/event-stream`, 12 staged events); `WorkspaceView` reducer maps each `SseEvent` to an `AgentStep` trace card in real time.
- Sub-header (`# TASK-*`, risk pill, `RUNNING`/`COMPLETED`), 3-panel layout (`ContextPanel` / `AgentConsole`+`TaskComposer` / `ArtifactPanel`), bottom `EXECUTION PROGRESS` bar, error banner, `ProvenanceDrawer` (`Why should I trust this result?`).
- Uploads are removable; sovereignty footer shows `0 EGRESS`.

### Knowledge Base

Real local corpus — not static mock data:

- `GET /documents` table (searchable, `Indexed ✓` + size + date), `POST /upload` (PDF/image → OCR → ChromaDB `indexed`/`unavailable`), `DELETE /knowledge-base/{id}` (admin, `knowledge:delete`).
- Seeded on first backend start from `backend/data/seed/*.md` (SOP-PUMP-042, manuals, standards, prior notes) via `seed_knowledge_if_empty()` (500-char chunks, 50 overlap, `all-MiniLM-L6-v2`).

### Sovereignty Monitor

Real measured proof — not an assertion:

- `GET /sovereignty-status` → `Sovereign Mode Active` banner, 4 tiles (`Internet BLOCKED`/`Outbound`/`Blocked Attempts`/`Local Services`), **Active Local Services** (from `local_services[]` with `online` dots), **Model Integrity** (`model_integrity[].sha256` + `verified`), plus data-location + activity log scaffolding.

### Models

`GET /models` registry — 3 Qwen cards (General/Coder/Vision), spec grid, capability chips, `SHA256 ✓ Verified` + endpoint. Falls back to `FALLBACK_MODELS` when offline.

### Tools / Users / Policies (Admin)

- **Tool Registry** (`GET /tools`, `PermissionGate(model:read)`) — 6 tools with live probes (`sandbox`/`ocr`/`document-gen`/`rag`/`verification`/`model`).
- **Users & Roles** (`GET /users`, `PermissionGate(user:manage)`) — `ID | Username | Role | Created`, role chips, JWT-bound-role banner.
- **Policies** (`GET /policies`, `PermissionGate(admin:access)`) — `policies.yaml`: risk rules, approval thresholds, sovereignty policy.

### Approvals

`GET /tasks` (approver/admin) → pending table (`Task`/`Engineer`/`Risk`/`Evidence`/`Created`/`Review →`), 4 stat cards (live pending/high; approved/returned scaffold), `ReviewWorkspace` 2-col split (PDF placeholder left, deliverable right with real `evidenceCount` + `generatedFile`), `Approve & Sign` / `Return for Revision` → `POST /tasks/{id}/approve|reject`.

### Home

Role-specific — `EngineerHome` (greeting + New Task + Recent Deliverables strip + 6 template cards → `workspace`), `ApproverHome` (4 **real** `GET /tasks` metric cards + live top-4 queue), `AdminHome` (Air-Gap Verified banner + 4 workload gauges scaffold + Active Models/Microservices + `SYSTEM LOG // stdout` terminal). `AppShell` owns the `System Overview` → `HomeDashboard` mapping per role.

### Landing / Auth

- **Landing** — hero, terminal indicator, capabilities, air-gapped architecture, FAQ, CTA; sticky top bar → `Sign In` / `Enter Workbench`.
- **Auth** — `POST /auth/login` (bcrypt + 8h JWT), stores token + user (`localStorage`), global 401 handler.

## Backend connection

```bash
cd ../backend
python -m uvicorn app.main:app --reload --port 8000
```

`../backend/README.md` for the full API + pipeline docs.

## Authentication

All protected calls attach `Authorization: Bearer <JWT>` (via `lib/auth.ts` + `lib/api.ts:request()`). Role comes from the signed token; demo switching re-issues a short-lived demo JWT via `POST /demo/switch-role`. 401s clear the session and redirect to Auth.

## Frontend structure

```text
src/
├── App.tsx                        # landing → auth → workbench router + 401 handler
├── main.tsx / index.css
├── components/
│   ├── layout/AppShell.tsx        # header pills (air-gapped/GPU/outbound/role) + Sidebar chrome
│   ├── layout/Sidebar.tsx         # role-aware nav (engineer 6 / approver 7 / admin 14)
│   ├── ui/                        # Icon, ThemeToggle, …
│   └── workspace/                 # ContextPanel, ExecutionTrace, ArtifactPanel, TaskComposer, ProvenanceDrawer
├── features/home/HomeDashboard.tsx
├── lib/
│   ├── api.ts                     # single API surface (fetch + SSE streamChat)
│   ├── auth.ts                    # token + user + 401 handler
│   ├── permissions.ts             # ROLE_PERMISSIONS + PermissionGate
│   ├── types.ts                   # ViewId/Permission/Task/AgentStep/SseEvent/…
│   └── mockData.ts                # only the 6 workflow starter prompts remain
└── views/
    ├── WorkspaceView.tsx          # streaming reducer (12 SSE stages → AgentStep)
    ├── KnowledgeBaseView.tsx      # real GET /documents + upload + admin delete
    ├── SovereigntyMonitorView.tsx # measured GET /sovereignty-status
    ├── ModelsView.tsx / ToolsView.tsx / UsersView.tsx / PoliciesView.tsx
    ├── ApprovalsView.tsx
    ├── WorkbenchApp.tsx           # shared state + GET /me sync + PermissionGate mounts
    ├── LandingPage.tsx / AuthPage.tsx
    └── …
```

## Notes for extending the frontend

- Keep all API calls in `lib/api.ts`.
- Keep `mockData.ts` limited to workflow starter prompts — don't reintroduce mock runtime paths.
- Preserve the `slate/navy/ink/line/signal` token system and the `react-jsx` Fragment fix in `permissions.ts` (`React.createElement`).
- Use `npm run build` to typecheck + build (1603 modules, ~9s, `tsc --noEmit` 0).
