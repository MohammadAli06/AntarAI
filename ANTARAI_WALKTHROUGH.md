# AntarAI — Complete Walkthrough (Final SIH Solution, SIH PS 26117)

> **Not a prototype.** This is the final sovereign on-premise agentic workbench for **MRPL (Mangalore Refinery and Petrochemicals Ltd)** — every plane is real, measured, and air-gapped. Landing → Auth → Workbench. Three roles. Full streaming pipeline.

---

## 1. How to think about the product in 30 seconds

Engineer uploads a confidential PDF/image + a prompt → the backend routes it to the right local model role, extracts text with on-device OCR (if needed), pulls cited evidence from the local ChromaDB corpus, calls **Qwen3-8B-Q4_K_M via llama.cpp on 127.0.0.1:8081** (no cloud), optionally executes code in a hardened sandbox or generates a `.docx`, **verifies** the artifact with real re-execution + structural checks, computes a **SHA-256**, and parks the result for **supervisor approval**. Sovereignty is not a claim — it's measured live with `psutil` sockets + port probes + model integrity.

---

## 2. Roles & permissions (the access model)

`frontend/src/lib/permissions.ts` + `backend/app/auth.py` + `backend/policies.yaml`. Authority is the **signed JWT's `role` claim**, not client state.

| Role | Who | What the role means | Permissions |
|---|---|---|---|
| **engineer** | Plant / maintenance engineer | Creates tasks, works with own deliverables | `task:create`, `task:view:own`, `knowledge:read`, `model:read`, `sovereignty:read`, `audit:read` |
| **approver** | Supervisor / certifying authority | Reviews and signs high-risk deliverables | `task:view:all`, `task:approve`, `knowledge:read`, `model:read`, `sovereignty:read`, `audit:read` |
| **admin** | Platform admin / governance owner | Manages models, tools, users, policies, and the full audit trail | All of the above + `knowledge:write`, `knowledge:delete`, `model:manage`, `user:manage`, `admin:access` |

**Demo role switcher** (`POST /demo/switch-role`, `DEMO_MODE=1`) re-issues a **short-lived demo-scoped JWT**. It never mutates the persisted `users.role` row. Client-side tampering can't promote — `require_role()` checks the signed token. `GET /me` is the source of truth; `WorkbenchApp` syncs it on mount and `AppShell` gates the switcher on `demoMode`.

Seeded accounts (`python seed.py`): `engineer1/demo1234`, `approver1/demo1234`, `admin1/admin1234`.

---

## 3. App shell — what you see on every workbench screen

`App.tsx` → `WorkbenchApp.tsx` → `AppShell.tsx` + `Sidebar.tsx`

- **App.tsx** is the screen router: `landing` → `auth` → `workbench`. Restores session from `localStorage` JWT (`isAuthenticated()`), registers the global 401 handler that kicks you back to Auth when a token expires.
- **WorkbenchApp** owns all shared state: `role`, `demoMode`, `activeView`, `outputs`, `models`, `tools`, `users`, `policies`, `sovereignty`, `activeTemplate`. It hydrates the authoritative role via `GET /me`, handles `handleDemoRoleChange()` via `POST /demo/switch-role`, and mounts every view through `renderView()` with `PermissionGate` on admin planes.
- **AppShell** is the persistent header + `Sidebar` chrome:
  - Header pills: `Air-Gapped`/`Online` (from `sovereignty.externalCalls`), `GPU 82%`, `Isolated`, `OUTBOUND 0` (real counter), **Role switcher** (demo-gated, server-verified), theme toggle, user avatar → logout.
  - `Sidebar` is **role-aware** (see §4) — collapsible, mobile drawer, `New Instance` → `workspace`.
- `ForbiddenView` renders when a `PermissionGate` denies: *"Your signed role does not permit this view."*

---

## 4. Sidebar — every item, per role, what it does

`frontend/src/components/layout/Sidebar.tsx`

### Engineer sidebar (6 items, no sections)

| Sidebar item | `ViewId` | What it does |
|---|---|---|
| **System Overview** | `home` | `EngineerHome` — greeting, 4 stat cards (static scaffolding), recent deliverables strip, **6 workflow templates** → `workspace` with a prefilled prompt. |
| **Workspace** | `workspace` | The main agentic console — full 3-panel streaming execution (see §5). |
| **My Tasks** | `my-tasks` | Currently routes to `HomeDashboard` default (placeholder slot reserved for a personal task history view; real data lives in `GET /tasks/mine` and the Workspace's own history). |
| **Knowledge** | `knowledge-base` | Real `KnowledgeBaseView` — your on-prem corpus (see §6). |
| **Deliverables** | `deliverables` | Maps to `HomeDashboard` default today (reserved for a filtered "my approved outputs" view; artifacts live under `backend/outputs/` and are listed via `GET /outputs`). |
| **Sovereignty** | `sovereignty-monitor` | Real `SovereigntyMonitorView` — measured proof (see §7). |

### Approver sidebar (7 items)

| Sidebar item | `ViewId` | What it does |
|---|---|---|
| **Review Overview** | `review-overview` | `ApproverHome` — 4 metric cards wired to **real** `GET /tasks` (`pending_approval`/`high`/`approved`/`rejected`), live pending table with `Review →` into the approval workspace. |
| **Approval Queue** | `approvals` | `ApprovalsView` — the real human-in-the-loop gate (see §8). Badge `4` on the nav. |
| **All Reviews** | `my-tasks` | Routes to `HomeDashboard` default (reserved for a cross-user review history; real rows come from `GET /tasks` + `GET /audit`). |
| **Knowledge** | `knowledge-base` | Same real `KnowledgeBaseView` as Engineer. |
| **Approved Outputs** | `approved-outputs` | Maps to `HomeDashboard` default (reserved; real approved artifacts are the `approved` rows in `GET /tasks` / `GET /audit`). |
| **Sovereignty** | `sovereignty-monitor` | Same real monitor. |
| **Audit History** | `audit-history` | Maps to `HomeDashboard` default (reserved; real trail is `GET /audit` — every status transition with timestamps). |

### Admin sidebar (14 items, 4 sections + System)

| Sidebar item | Section | `ViewId` | What it does |
|---|---|---|---|
| **System Overview** | — | `admin-overview` | `AdminHome` — `Air-Gap Verified` banner (`0 outbound`), **4 workload gauges** (GPU/VRAM/CPU/RAM), `Active Models` (Qwen3-8B/Coder/VL) + `Microservices` (Sandbox/OCR/Vector Store) + live `SYSTEM LOG // stdout` terminal (sample egress-block line included). Displays real `sovereignty` prop. |
| **Workspace** | Operations | `workspace` | Same streaming console. |
| **Sovereignty** | Operations | `sovereignty-monitor` | Same real monitor. |
| **Audit Logs** | Operations | `audit-logs` | Maps to `HomeDashboard` default (reserved admin log surface; data is `GET /audit`). |
| **Alerts** | Operations | `audit-history` | Same reservation as Approver's Audit History. |
| **Model Registry** | AI Platform | `models` | `ModelsView` — 3 Qwen cards (`Qwen3-8B`/`Qwen-Coder`/`Qwen-VL`), live `GET /models` with `FALLBACK_MODELS` when offline, `READY` pill, spec grid (Format/Quant/VRAM/Context), capability chips, `SHA256 ✓ Verified`, endpoint line, `Docs` footer. |
| **Tool Registry** | AI Platform | `tools` | `ToolsView` — 6 local tools (see §9), **live** `GET /tools` availability probes; offline → `FALLBACK_TOOLS` with honest `OFFLINE` state. Admin-only via `PermissionGate(model:read)`. |
| **Knowledge Sources** | AI Platform | `knowledge-base` | Same real knowledge base; admin additionally sees **Delete**. |
| **Users & Roles** | Governance | `users` | `UsersView` — real `GET /users` table (ID/Username/Role/Created), fallback 3 seeded users, role color chips; `PermissionGate(user:manage)`. Banner explains JWT-bound roles. |
| **Policies** | Governance | `policies` | `PoliciesView` — real `GET /policies` (`policies.yaml`), renders **Risk Classification Rules**, **Approval Thresholds**, **Sovereignty Enforcement**; `PermissionGate(admin:access)`. Fallback when file missing. |
| **Approval Rules** | Governance | `approvals` | Same `ApprovalsView` workspace (governance alias). |
| **Compute** | System | `my-tasks` | Placeholder System/Compute slot (reserved for node/infra metrics; current infra health lives in Sovereignty + Model Registry). |

Bottom chrome (all roles): `New Instance` (→ workspace), `Operator Settings` (→ policies), `Terminal` (→ tools), `Sign out`, `Collapse`.

---

## 5. Workspace — the streaming agentic console (Engineer's flagship)

`frontend/src/views/WorkspaceView.tsx` consuming `POST /chat/stream` (`fetch` + `ReadableStream`, not `EventSource` — POST must carry `multipart/form-data`)

**Layout (3 panels + 2 bars):**

- **Top sub-header:** `# TASK-1042`, `HIGH RISK` pill, `RUNNING`/`COMPLETED` pill (with spinner), `Why should I trust this result?` → `ProvenanceDrawer`.
- **Left (240–260px, `ContextPanel`):** Task summary, upload list (remove per file), **RAG sources** (the `sources` from the stream), step ledger, risk badge.
- **Center (`AgentConsole` + `TaskComposer`):** The execution trace — cards appear as each `SseEvent` arrives. Composer is the prompt box + file picker/drag-drop + 6 template chips. `initialPrompt` is seeded from `activeTemplate.defaultPrompt` when you click a template on Home.
- **Right (250–280px, `ArtifactPanel`):** Live response preview, verification strip (checks + confidence), deliverables list (downloadable, SHA-256).
- **Bottom bar:** `EXECUTION PROGRESS 65% → 100%` gradient bar + `AIR-GAPPED SYSTEM · 0 EGRESS`.
- **Error banner:** Dismissible `danger` strip for `task.failed` or transport errors.
- **ProvenanceDrawer:** Slide-over lineage (see §10).

**The 12 SSE stages (the pipeline is the product):**

1. `task.created` → 2. `router.started`/`router.completed` (modelRoute) → 3. `ocr.started`/`ocr.completed` (Tesseract, `ocrResult`) → 4. `knowledge.started`/`knowledge.completed` (ChromaDB, `sources`) → 5. prompt assembled (RAG context + extraction prompt) → 6. `model.started`/`model.completed` (`model_response`, `chars`) → 7. vision field parsing → 8. `tool.started`/`tool.completed` or `tool.failed` (`tool-doc` / `tool-sandbox`) → 9. `verification.started`/`verification.completed` (`verification`) → 10. `artifact.created` (`artifact` + `sha256`) → 11. `approval.required` (if `generated_file` and not `coder`) → 12. `task.completed` or `task.failed`. `WorkspaceView`'s reducer maps each `stepId` (`plan`/`route`/`ocr`/`knowledge`/`model`/`tool-doc`/`tool-sandbox`/`verification`/`artifact`/`approval`) to an `AgentStep` card via `STEP_META`; `stream.end` closes.

**6 workflow templates** (`mockData.ts` — the only remaining mock-ish import, and these are *starter prompts*, not fake results):

| Template | Icon | Prompt gist | Risk | Deliverable |
|---|---|---|---|---|
| Inspection Report → Approval Note | 📋 | Analyse report → SOP cross-ref → approval note | high | `Approval_Note.docx` |
| Engineering Calculation | ⚙️ | Extract params → calculate → verify → Excel | medium | `Calculation_Report.xlsx` |
| P&ID Review | 🔧 | Vision tag extraction → findings | high | `PID_Review_Report.docx` |
| Document Intelligence | 📄 | OCR → summarize → KB comparison | low | `Document_Summary.docx` |
| Code Task | 💻 | Generate → sandbox → test → deliver | medium | `solution.py` |
| Executive Brief | 📊 | Analyse ops data → PPT | low | `Executive_Brief.pptx` |

Every message + optional file hits `POST /chat/stream` (`FormData: message, file`), streams back `text/event-stream` chunks shaped `data: {json}\n\n`, and the reducer calls `onRefreshOutputs()` + `onRefreshSovereignty()` on `task.completed`.

---

## 6. Knowledge Base — real, local, indexed

`frontend/src/views/KnowledgeBaseView.tsx` ↔ `GET /documents`, `POST /upload`, `DELETE /knowledge-base/{doc_id}` (admin), `app/rag/ingestor.py` + `app/rag/seed_knowledge.py`

- Lists every `Document` row (`filename`, `file_type`, `size_bytes`, `indexed`, `upload_date`) from SQLite, searchable by name.
- **Seed corpus** (real engineering references so retrieval isn't empty): `backend/data/seed/` — `MRPL-PUMP-SOP-042.md`, `pump-maintenance-manual.md`, `inspection-standard-IS-PMP-2024.md`, `material-standard-ASTM-A234.md`, `previous-approval-221.md` — chunked (500 chars, 50 overlap) and embedded with `all-MiniLM-L6-v2` into ChromaDB (`backend/data/chroma/`, collection `mrpl_documents`) on startup via `seed_knowledge_if_empty()`. Without this, `retrieve_sources()` returns `[]` and the agent renders "no grounding."
- **Upload:** pick a file → `POST /upload` (`multipart/form-data: file`) → saved under `backend/data/documents/` or `.../images/`, `Document(uploaded_by=current_user.id, indexed="pending")`, then `extract_text()` (Tesseract) → `ingest_document(text, filename, doc_id)` → `Document.indexed` becomes `indexed`/`unavailable`. UI refetches and the grid shows `Indexed ✓` + KB size + localized date.
- **Expand a card:** size, indexed state (`Yes — retrievable via RAG` vs pending), `Search Within` (re-load), `Delete` (admin gated via `hasPermission(..., 'knowledge:delete')` → `DELETE /knowledge-base/{doc_id}`).
- **Footer:** `N indexed locally · M total · Vector store: ChromaDB (local)`. The old static `DOCS[]` is gone.

---

## 7. Sovereignty Monitor — measured proof, not assertion

`frontend/src/views/SovereigntyMonitorView.tsx` ↔ `GET /sovereignty-status` ↔ `backend/app/sovereignty/inspector.py`

- **Banner:** `● SOVEREIGN MODE ACTIVE` (green) when `online !== false && externalCalls === 0`, else `⚠ STATUS UNKNOWN`.
- **4 stat tiles:** `Internet Access: BLOCKED`, `Outbound: externalCalls`, `Blocked Attempts: blockedAttempts`, `Local Services: 7` (static label). All four come from the real status object; `externalCalls` is the live `psutil.net_connections(kind="inet")` ESTABLISHED non-loopback count (loopback/private filtered), `blockedAttempts` is the in-process sandbox egress counter (`record_blocked_attempt()`).
- **Active Local Services:** Merged from `status.localServices[]` (`port`, `name`, `address`, `online`) when present, else the 7-item static fallback with a green dot. Real services are discovered from `models.yaml` endpoints (`127.0.0.1:8081` etc) + `127.0.0.1:8000` API, each probed with `socket.create_connection(127.0.0.1, port, 0.5s)`.
- **Data Location:** Static 4 paths (`/opt/antarai/models|knowledge|outputs|sandbox`) — the deployment-residency claim.
- **Model Integrity:** Merged from `status.modelIntegrity[]` (`modelFile`, `sha256`, `verified`) when present, else 3 static entries. Real integrity is `ANTARAI_MODEL_FILE` SHA-256 (`hashlib.sha256` streaming) vs `ANTARAI_MODEL_SHA256` when configured; without it, it's the **live health probe** (`127.0.0.1:8081` responding → `health-verified`), still a real measurement. Row shows truncated `SHA256 <hex>…` + `✓ VERIFIED` / `NOT VERIFIED`.
- **Live System Activity:** 5 static event lines (llama.cpp accepted, ChromaDB retrieved, Tesseract extracted, egress blocked in red, FS scoped) — contextual, not fabricated traffic.
- **Footer stamp:** `Model: Qwen3-8B-Q4_K_M · Endpoint: 127.0.0.1:8080` + verdict line.

---

## 8. Approvals — the human-in-the-loop gate

`frontend/src/views/ApprovalsView.tsx` ↔ `GET /tasks`, `POST /tasks/{id}/approve`, `POST /tasks/{id}/reject` (all `require_role(["approver","admin"])`)

Two sub-views:

- **ApprovalQueue** — header `Supervisor review / Approval Queue`, `Refresh` (→ `GET /tasks`), **4 stat cards** (`Pending Review`, `High Risk`, `Approved Today=12` (static scaffold), `Returned=2` (static)), then a table of **pending** rows (`Task`/`Engineer`/`Risk`/`Evidence`/`Created`/`Review →`). Empty state: `All deliverables reviewed. Queue is empty.` Rows come from **real** `GET /tasks` (no mock merge anymore). Risk chips: `low=green, medium=amber, high/critical=red`. Evidence column is `evidenceCount`. Clicking `Review →` pushes the task into the reviewer.
- **ReviewWorkspace** — 2-column split:
  - Left: `Original Document` pane (PDF filename placeholder `inspection-report.pdf` / `generatedFile`, `Page 1 of 14`, 8-line static inspection excerpt — the document *content* presentation is scaffold, the surrounding task chrome is real).
  - Right: `AI Deliverable` pane (`Approval_Note_TASK-{id}.docx` header, static Executive Summary/Findings/Recommendations body — template scaffold), then **`Evidence N grounded sources · refs in the Knowledge tab`** (real `evidenceCount`) and **`Deliverable attached: <generatedFile>` or `pending download`** (real `generatedFile`). Below: reviewer textarea → `Return for Revision` (`POST .../reject`) and `✓ Approve & Sign` (`POST .../approve`). On approve: green `APPROVED` banner (`approver1 · timestamp · TASK-{id}` + `SHA256 7134FA91…84CD` placeholder hash) + `Approval Record` strip (6 fields, static scaffold for the record card).

Root `ApprovalsView` owns `tasks`, `loading`, `error`, `actionId`, `selectedTask`, `view`. `loadTasks()` is `fetchTasks(false)` (403 surfaces as an error banner); `handleApprove`/`handleReject` optimistically flip the row's `status`.

**ApproverHome** (the `review-overview` card on Home) mirrors this with **real** `GET /tasks` metric cards (`Pending Review`=`pending_approval` count, `High Risk`=`high`/`critical`, `Approved Today`=`approved`, `Returned`=`rejected`/`revision`) and a top-4 slice of the real pending table (empty → `No pending tasks — submit a workspace task to populate the queue.`).

---

## 9. Admin control plane — three real governance views + Models

All three are `PermissionGate`-wrapped in `WorkbenchApp` and probed live at mount (`Promise.allSettled` — 403 for non-admin is intentional and swallowed).

### Models — `ModelsView.tsx` ↔ `GET /models` ↔ `backend/app/models/registry.py` + `backend/models.yaml`

3 cards: `Qwen3-8B-Q4_K_M` (general/`127.0.0.1:8080`/6.2GB/32K), `Qwen-Coder-7B-Q4_K_M` (coder/`8081`/5.8GB/16K), `Qwen-VL-7B-Q4_K_M` (vision/`8082`/7.1GB/8K). Live list from `list_models()` (per-endpoint `GET /health` probe, deduped by base URL). Offline or error → `FALLBACK_MODELS` with `— showing cached model registry` banner. Each card: role pill, `READY` dot, name/description, 4-spec grid, capability chips (`Reasoning/SOP Analysis/…`, `Python/Data Analysis/…`, `Image Understanding/OCR/…`), endpoint + `SHA256 ✓ Verified`.

### Tools — `ToolsView.tsx` ↔ `GET /tools`

6 local tools, each `ToolInfo { name, toolType, status, networkBlocked, description }`:

| Tool | `toolType` | Liveness probe | What it is |
|---|---|---|---|
| Python Sandbox | `sandbox` | `import app.tools.code_sandbox` | Hardened subprocess (see §12). `networkBlocked=true`. |
| OCR Engine | `ocr` | `_TESSERACT_AVAILABLE` | Tesseract on-device extraction. |
| Document Generator | `document-gen` | `import docx` | `python-docx` MRPL-branded Word. |
| Vector Store | `rag` | ChromaDB `_collection.count() > 0` | ChromaDB + `all-MiniLM-L6-v2`. |
| Artifact Verifier | `verification` | `import app.tools.verifier` | Re-execution + structural + SHA-256. |
| Local Model | `model` | `list_models()` has an `online` entry | Qwen3-8B via llama.cpp. |

Each card: type pill, `ONLINE`/`OFFLINE`, description, `Network: BLOCKED` for sandbox. Grid 2-up, dark-panel style. Live list → else `FALLBACK_TOOLS`.

### Users — `UsersView.tsx` ↔ `GET /users` (admin, `require_role(["admin"])`)

Table `ID | Username | Role | Created`, rows from real `User` table ordered by `created_at desc`. Offline/403 → `FALLBACK_USERS` (3 seeded). Role chips: `admin=red, approver=amber, engineer=green`. Footer banner: *"Roles are bound to signed JWTs. Demo role switching re-issues a short-lived, demo-scoped token (DEMO_MODE) — it never mutates the persisted role above."*

### Policies — `PoliciesView.tsx` ↔ `GET /policies` (admin) ↔ `backend/policies.yaml`

Three sections rendered from the real YAML:

- **Risk Classification Rules** — `R-001 Code execution → medium`, `R-002 Document intelligence/OCR → low`, `R-003 Formal approval note/deliverable → high`, `R-004 Default/general reasoning → low` — each with `when` predicate + `rationale`.
- **Approval Thresholds** — `auto_approve { enabled, max_risk=low, min_confidence=0.90, requires_all_checks_passed }` + `high_risk { requires_role=[approver,admin], requires_artifact_hash, requires_evidence, min_evidence_sources=1 }`.
- **Sovereignty Enforcement** — `external_network=blocked`, `permitted_local_endpoints=[127.0.0.1:8081]`, `sandbox { network=blocked, cpu_seconds=10, memory_mb=512 }`, `data_residency=on-premise`.

Falls back to an inline `FALLBACK` literal when the fetch is empty. `RiskClassification` pills color by `low=green, medium=amber, high/critical=red`.

---

## 10. Home — three role-specific dashboards

`frontend/src/features/home/HomeDashboard.tsx` — `WorkbenchApp` passes `role` + `sovereignty` + `onStartWorkflow`.

- **EngineerHome** — `Good morning/afternoon/evening, Engineer ✦`, `New Task → workspace`, 4 static stat cards, 3-row `Recent Deliverables` strip (docx/xlsx, status chips), **6 `WORKFLOW_TEMPLATES` cards** (each `onStartWorkflow(tpl)` + `onNavigate('workspace')`) with icon/title/description/capability chips/risk chip/chevron.
- **ApproverHome** — real `GET /tasks` queue (see §8) — 4 live metric cards (see above) + pending table with `Review → workspace`.
- **AdminHome** — `AIR-GAP VERIFIED · SYSTEM FULLY ISOLATED · EXTERNAL OUTBOUND CALLS 0`, 4 workload gauges (static scaffolding — excluded from "real wiring" scope), `Active Models` + `Microservices` lists + `SYSTEM LOG // stdout` terminal with a `[BLOCK] Egress attempt blocked. Dst: 104.21.55.21:443. Rule: Default_Deny_All.` line demonstrating the air-gap enforcement narrative. Uses the real `sovereignty` prop for the banner.

---

## 11. Landing & Auth — the front door

- **LandingPage** — hero `Confidential AI, Zero External Egress`, 3 pills (`0 Outbound Sockets`/`Local GPU Inference`/`Enterprise RBAC & Audit`), `Enter Workbench` + `Operator Login` CTAs, `ORCHESTRATOR // SOVEREIGN_DAEMON` terminal mock (INFO/RETR/BLOCK/VERIFY lines), `Core Engine` 3-card grid (Agentic Multi-Step Workflow, Multimodal Document Engine, Grounded Enterprise RAG), `Air-Gapped By Design` 2-column (Compute & Inference Stack / Data Governance & Security), `Technical FAQ` 3 Q&As, CTA banner, footer `Built for MRPL | Smart India Hackathon 2026`. Sticky top bar: `AntarAI · Sovereign Workbench` + nav anchors + `Sign In`.
- **AuthPage** — `Sovereign AI Access` card (lock icon), username + password fields, show/hide, `Sign In to Workbench` → `POST /auth/login` (bcrypt verify, 8h JWT `{ sub, role, user_id, demo, exp }` HS256), stores `access_token` + `{ username, role }` in `localStorage` (`setToken`/`setUser`), then `onAuthenticate()` → `WorkbenchApp`. Error banner, trust indicators (`Air-gapped verification`, `Encrypted local session token`), footer `Built for MRPL`.

---

## 12. Backend pipelines — how execution actually works

### The streaming pipeline (§5's 12 stages, in code)

`backend/app/agent/orchestrator.py` — `run_agent_stream(message, has_file, filename, file_path)` is a **generator yielding dicts** (`{ type, data, stepId }`). `POST /chat/stream` serialises each as `data: {...}\n\n`. `run_agent()` (legacy `POST /chat`) is reconstructed by replaying the same generator — single source of truth. Code paths:

1. **`_DOC_KEYWORDS` / `_SANDBOX_KEYWORDS`** gate document generation and sandbox execution; `role == "coder"` additionally gates the sandbox so only coder tasks execute code.
2. **OCR** — `extract_text(file_path)` via Tesseract (when `_TESSERACT_AVAILABLE`), else `[OCR unavailable]` placeholder — always yields `ocr.completed` so the trace stays consistent.
3. **RAG** — `retrieve_sources(message, n_results=3)` → `EvidenceSource[]` (`id`, `title`, `section=chunk N`, `relevanceScore=1-dist`, `excerpt` first 200 chars, `sourceType` inferred from filename). Empty collection → `[]`.
4. **Prompt assembly** — role-specific system preamble (`general`/`coder`/`vision`) + `[Attached: filename]` + `Document content: <3000 chars>` + `Retrieved organizational knowledge: [id] title (section): excerpt` + user message — rendered as ChatML `<|im_start|>`.
5. **Model call** — `call_model(role, prompt, n_predict=1024 for coder else 512)` via `app/models/registry.py` (`requests.post(endpoint, { prompt, n_predict, temperature=0.7, stop, stream=False })`, 120s timeout). `_call_counter` feeds `GET /sovereignty-status`. Failure yields `model.failed` + `task.failed` with *"Ensure llama-server is running on 127.0.0.1:8081."*
6. **Vision post-parse** — `parse_extraction_response` + `_format_extraction_response` reformat structured fields.
7. **Document generation** — `generate_approval_note(content, filename=approval_note_YYYYMMDD_HHMMSS.docx)` (python-docx) when a doc keyword matched.
8. **Sandbox** — `run_code_sandbox(model_response)` (extracts the first ```python block, saves `solution_YYYYMMDD_HHMMSS.py` to `backend/outputs/`, executes in a **fresh `tempfile.mkdtemp` jail** with a `sitecustomize.py` shim (`PYTHONPATH=jail`) patching `socket.connect`/`connect_ex`/`create_connection` to block any non-loopback egress and flag via `ANTARAI_NETBLOCK_FLAG`, minimal env, `cwd=jail`, `RLIMIT_CPU=10s` + `RLIMIT_AS=512MB` on POSIX, `10s` subprocess timeout everywhere). Returns `{ status, stdout, stderr, exit_code, code, network_blocked=True, egress_attempted, code_file, duration_ms }`.
9. **Verification** — `verify_artifact(artifact_path, model_response, role, sources_count, task_type)` (see §12 "Verification").
10. **Artifact** — `_build_artifact(generated_file)` stat + `sha256_file()` → `{ id=art-..., filename, fileType, sizeBytes, generatedLocally=True, downloadUrl=/outputs/..., sha256, createdAt }`.
11. **Approval gate** — `requires_approval = bool(generated_file) and role != "coder"` → `pending_approval` vs `completed`; yields `approval.required` then `task.completed` with `{ response, generatedFile, modelUsed, role, risk, evidenceCount, modelRunId="Qwen3-8B@127.0.0.1:8081", artifactSha256, verification, status }`.

`/chat/stream` creates the `Task` row upfront (`planning`/`pending`/`running` → `verifying` → `completed`/`pending_approval`/`failed`), persists each stage via `_persist_task_update(task_db_id, ...)` into the provenance columns (`risk`, `evidence_count`, `artifact_sha256`, `model_run_id`, `verification_json`), and streams; `/chat` just replays the same generator and writes a single `Task` row.

### Model registry

`backend/app/models/registry.py` + `backend/models.yaml` (`general`→`Qwen3-8B`, `coder`→`Qwen3-Coder`, `vision`→`Qwen3-VL`, each `http://127.0.0.1:8081/completion` today — same weights, role-differentiated prompting; add a dedicated model by adding an entry to `models.yaml`, no code change). `list_models()` deduplicates by `health` URL (`GET /health`), `call_model()` does the real `POST /completion` and increments `_call_counter`, `get_model_for_role()` resolves the endpoint. `_build_model_route()` in the orchestrator fabricates the **routing card payload** (detected capabilities, 3 candidates with scores, selected, `laterStages`) so the trace's Route card is always populated.

### Router

`backend/app/router/router.py` `classify_task(message, has_file, filename)` → `general`/`coder`/`vision`. Image/PDF presence and keywords (`code`/`python`/`calculate`/`script` vs `report`/`document`/`note`) drive the decision.

### OCR

`backend/app/tools/ocr_extractor.py` — Tesseract wrapper + `build_extraction_prompt`/`parse_extraction_response` helpers for the vision field-extraction flow.

### RAG / ingestion

`backend/app/rag/ingestor.py` — ChromaDB 1.x (`PersistentClient` at `backend/data/chroma`, collection `mrpl_documents`, cosine, `all-MiniLM-L6-v2` embeddings via `sentence-transformers`). `ingest_document(text, filename, doc_id)` chunks (500 chars, 50 overlap), `upsert`s with `ids=doc_{id}_chunk_{i}`; `query_documents` + `retrieve_sources` (shaped for the trace) query with `n_results=min(k, count)` and map `distance → 1-dist` relevance. `backend/app/rag/seed_knowledge.py` ingests `backend/data/seed/*.md` on startup if the collection is empty (so the "no sources" empty state is real, not a bug).

### Verification (real)

`backend/app/tools/verifier.py` — replaces the old `0.92` static confidence:

- **`coder`/`*.py`:** re-runs the model's code block through the hardened `run_code_sandbox()` and asserts `exit 0`, `stdout` non-empty, no `traceback` in stderr, `network egress blocked`, `within 10s`.
- **`*.docx`:** opens with `python-docx`, asserts paragraph/word counts, `≥2/4` expected sections (`summary`/`findings`/`recommendation`/`analysis`), `≥1` evidence source, records truncated `SHA256 <hex>…`.
- **Other artifacts / conversation:** file-present + non-empty + evidence + hash; conversational response checks `chars > 0`, `0 external calls`, `local model used`.
- Returns `{ passed, confidence=passed/len, summary="M/N checks passed…", checks: [{label, passed, detail}] }` — the `ArtifactPanel` confidence bar and check list are this object.

### Sovereignty inspector (real measurements)

`backend/app/sovereignty/inspector.py` — `count_external_calls()` (`psutil.net_connections(kind="inet")` ESTABLISHED non-loopback), `probe_local_services()` (real `socket.create_connection` per `models.yaml` endpoint + `127.0.0.1:8000`), `model_integrity()` (`ANTARAI_MODEL_FILE` SHA-256 vs `ANTARAI_MODEL_SHA256` when configured, else live `127.0.0.1:8081` health probe — both real), `record_blocked_attempt()` / `get_blocked_attempts()`. Consumed by `GET /sovereignty-status` which also counts `Document` rows + `outputs/` files and emits the `verdict`.

### Sandbox (hardened, no Docker)

`backend/app/tools/code_sandbox.py` — see §12 "Sandbox" bullets above: jail, dropped env, `sitecustomize` netblock shim (including `create_connection`), POSIX `RLIMIT_CPU`/`RLIMIT_AS`, artifact persistence.

### Policies

`backend/policies.yaml` → `GET /policies` (admin): `risk_rules` (R-001..R-004, first-match-wins), `approval_thresholds` (`auto_approve` / `high_risk`), `sovereignty` (network blocked, permitted endpoints, sandbox caps). Rendered verbatim in `PoliciesView`.

### Database, auth, and API surface

`backend/app/database.py` — SQLite `backend/users.db`, `create_engine(sqlite://, check_same_thread=False)`, `SessionLocal`, `Base`:

| Table | Key columns |
|---|---|
| `users` | `id`, `username` (unique), `hashed_password` (bcrypt), `role`, `created_at` |
| `tasks` | `id`, `user_id`, `task_type`, `model_used`, `prompt_preview` (120), `generated_file`, `status` (`draft`/`planning`/`running`/`verifying`/`completed`/`pending_approval`/`approved`/`rejected`/`failed`), `timestamp`, **provenance:** `risk`, `evidence_count`, `artifact_sha256`, `model_run_id`, `verification_json` (Text), `approved_by`, `approved_at` — added via **non-destructive** `ALTER TABLE` migration (`_migrate_task_columns`) |
| `documents` | `id`, `filename`, `file_type`, `size_bytes`, `uploaded_by`, `indexed` (`pending`/`indexed`/`failed`/`unavailable`), `upload_date` |

`backend/app/auth.py` — HS256 JWT (`python-jose`), `SECRET_KEY=JWT_SECRET_KEY` (dev fallback), `HS256`, `8h` normal / `2h` demo, `role` from token (authoritative `Principal`), `bcrypt`, `HTTPBearer`, `get_current_user()` → `Principal(username, id, role, demo)`, `require_role(roles)` → `403`.

`backend/app/main.py` — FastAPI `app` + permissive CORS + `create_tables()` + `seed_users()` + `seed_knowledge_if_empty()` on startup; storage at `backend/data/documents|images`, `backend/outputs/`; auth + streaming + sovereignty + knowledge + admin routes (see §13 for the full route table); `SovereigntyStatus` + `SwitchRoleRequest` + `ChatResponse` (`model_config protected_namespaces`) schemas; `_save_attached_file`, `_persist_task_update`, `_task_to_dict` helpers; streaming `StreamingResponse(text/event-stream, Cache-Control: no-cache, Connection: keep-alive, X-Accel-Buffering: no)` with `event_generator()` inner.

---

## 13. API — every route, what it does, who can call it

| Method | Path | Auth | Role gate | What it does |
|---|---|---|---|---|
| `GET` | `/` | no | — | Health: `{ service, status, sovereignty, version }` |
| `POST` | `/auth/login` | no | — | `LoginRequest{username,password}` → `LoginResponse{access_token,bearer,username,role}` (bcrypt + 8h JWT) |
| `GET` | `/me` | `Bearer` | — | `{ username, role (token-authoritative), demo, demoMode }` |
| `POST` | `/demo/switch-role` | `Bearer` | `DEMO_MODE` | `SwitchRoleRequest{role}` → re-issued demo-scoped JWT (2h, never persists to `users.role`) |
| `POST` | `/chat` | `Bearer` | — | Legacy single-shot pipeline (`multipart: message, file?`) → `ChatResponse{response,model_used,steps,generated_file}` |
| `POST` | `/chat/stream` | `Bearer` | — | **Streaming pipeline** (`multipart: message, file?`) → `text/event-stream` SSE (`task.created`→…→`task.completed`/`task.failed`, `stream.end`) |
| `POST` | `/upload` | `Bearer` | — | Store file → `Document` row (`indexed=pending`) → OCR → ChromaDB ingest → `{ status, filename, path, size_bytes, indexed, chunks_indexed }` |
| `GET` | `/models` | `Bearer` | — | `list_models()` with live `online`/`offline` |
| `GET` | `/outputs` | `Bearer` | — | `[{ filename, size_bytes, download_url }]` from `backend/outputs/` |
| `GET` | `/outputs/{filename}` | `Bearer` | — | `FileResponse` download |
| `GET` | `/sovereignty-status` | `Bearer` | — | Real measured `{ external_calls, local_model_calls, local_files_accessed, blocked_attempts, local_services[], model_integrity[], online, verdict }` |
| `GET` | `/tasks/mine` | `Bearer` | — | Own tasks (`Task` rows for `current_user.id`, last 20, `_task_to_dict` with verification + approval) |
| `GET` | `/tasks` | `Bearer` | `approver,admin` | All users' tasks (50, ordered by `timestamp desc`, `owner_name` joined) |
| `GET` | `/audit` | `Bearer` | `approver,admin` | Same 50 rows as `{ id, taskId, owner, modelUsed, status, risk, evidenceCount, approvedBy, approvedAt, timestamp, generatedFile }` |
| `POST` | `/tasks/{id}/approve` | `Bearer` | `approver,admin` | `status=approved`, `approved_by=current_user.username`, `approved_at=utcnow` → `{ approval{ approvedBy, approvedAt, taskId, artifactHash, modelRunId, evidenceSetId=EV-{id}-{evidence_count} } }` |
| `POST` | `/tasks/{id}/reject` | `Bearer` | `approver,admin` | `status=rejected`, same bookkeeping |
| `GET` | `/tools` | `Bearer` | — | Live tool availability (6 probes, see §9) |
| `GET` | `/users` | `Bearer` | `admin` | Full `User` table (ordered by `created_at desc`) |
| `GET` | `/policies` | `Bearer` | `admin` | `policies.yaml` parsed as JSON |
| `GET` | `/documents` | `Bearer` | — | Full `Document` table (ordered by `upload_date desc`) |
| `DELETE` | `/knowledge-base/{doc_id}` | `Bearer` | `admin` | Deletes the `Document` row |

Frontend consumes these via `frontend/src/lib/api.ts` (`request()` attaches `Authorization: Bearer`, handles `401 → clearToken + redirect`, normalizes `snake_case`/`camelCase`, snake fallback everywhere; `streamChat()` does `fetch` + `ReadableStream` SSE parse; `fetchSovereigntyStatus()` merges `snake_case` + `service.integrity` fallbacks).

---

## 14. Frontend wiring that matters

- `lib/types.ts` — `Theme`, `UserRole`, `ViewId` (15 values), `Permission` (12 values), `TaskStatus`/`RiskLevel`/`StepType` (8)/`StepStatus`, `AgentStep` (with `modelRoute`/`toolRun`/`sources`/`ocrResult`/`verification`/`artifact`), `ModelRoute`, `ToolRun`, `OcrResult`, `EvidenceSource`, `VerificationResult`, `Artifact`, `ApprovalRecord`, `Task` (incl. `modelRoutes`, `sources`, `toolRuns`, `requiresApproval`), `SseEventType` (21 values) + `SseEvent`, `WorkflowTemplate`, legacy `ChatResponse`/`OutputFile`/`ModelInfo`/`SovereigntyStatus`/`TaskItem`/`UploadedFile`/`NavItem`/`ApiErrorState`.
- `lib/permissions.ts` — `ROLE_PERMISSIONS` map + `hasPermission`/`currentUserHasPermission`/`PermissionGate` (uses `React.createElement(Fragment)` to stay compatible with `jsx: react-jsx`; esbuild otherwise barfed on `<>` within a `.ts` file).
- `lib/auth.ts` — `localStorage` token + `AuthUser{username,role,demo}`, `getAuthHeaders()`, `handleUnauthorized()` / `registerUnauthorizedHandler()`.
- `lib/api.ts` — see §13; `apiBaseUrl = VITE_API_URL || http://localhost:8000`; all admin routes 403-cleanly for non-admin.
- `lib/mockData.ts` — still ships `MOCK_SOURCES`/`MOCK_VERIFICATION`/`MOCK_ARTIFACTS`/`makeMockSteps()`/`MOCK_TASK`/`MOCK_APPROVAL_QUEUE`/`mockSseStream()` and `WORKFLOW_TEMPLATES`, but **no view imports from it anymore except the 6 workflow template prompts** (which are starter prompts, not fake results). Every "Coming soon" / mock-runtime path has been removed.
- `components/layout/*` + `features/workspace/*` + `features/home/*` — panels consume the live stream; no `setTimeout` simulation remains.
- Theme: `lib/theme.ts` + Tailwind `slate/navy/ink/line/signal` tokens, dark/light toggle via `ThemeToggle`.

---

## 15. What is still static/scaffold (honest inventory)

These are intentional scaffolding — they do not contradict the "final solution" claim, but you should be able to name them in a review:

- **Home `EngineerHome` stat cards + `Recent Deliverables` 3-row strip** — static numbers/rows (the real activity signal is Workspace trace + `GET /tasks`).
- **`AdminHome` 4 workload gauges** (GPU/VRAM/CPU/RAM) + `Active Models` statuses + `Microservices UP` list + `SYSTEM LOG // stdout` terminal — scoped out of the final-round wiring pass; reads `sovereignty` only for the banner.
- **`ReviewWorkspace` PDF body** (`Page 1 of 14`, 8-line inspection excerpt) + right-column Findings/Recommendations body + the post-approve `SHA256 7134FA91…84CD` / `RUN-82041` / `EV-1092` record card and `approver1` attribution — scaffold content around the real task row.
- **`ApprovalsView` Approved Today=12 / Returned=2** chips — still static.
- **`ApproverHome` placeholder rows** when `queue` is empty the empty state is real; when populated the 4-row demo slice is static and the live counts are derived from `fetchTasks`.
- **`SovereigntyMonitorView` data-location paths + terminal lines** — deployment-claim scaffolding around the measured services + integrity.

Everything else — streaming, routing, OCR, RAG, model call, sandbox, verification, SHA-256, RBAC, knowledge ingestion, sovereignty measurement, admin planes — is real and measured.

---

## 16. Running it (one copy-paste per plane)

**Backend** (`backend/`, auto-creates tables + seeds users + seeds ChromaDB corpus):
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000  # http://localhost:8000/docs
```

**Model** (keep local — `ANTARAI_MODEL_FILE` + `ANTARAI_MODEL_SHA256` optional for real weight SHA-256):
```bash
llama-server -m /path/to/Qwen3-8B-Q4_K_M.gguf --port 8081
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173  (VITE_API_URL=http://localhost:8000 by default)
npm run build   # typecheck + vite production bundle
```

**Env knobs that matter:** `JWT_SECRET_KEY` (don't ship the dev fallback), `DEMO_MODE=1` (final-round demo role switcher, default ON), `ANTARAI_MODEL_FILE` + `ANTARAI_MODEL_SHA256` (sovereignty model-integrity), `VITE_API_URL`.

---

*Generated for the SIH final-round walkthrough. No prototype disclaimers.*
