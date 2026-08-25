# Sovereign AI Workbench Frontend

This directory contains the React + TypeScript dashboard for AntarAI, a Sovereign On-Premise Agentic AI Workbench for confidential industrial work.

The interface is designed as a restrained operator console for refinery engineers. It provides task execution, local model routing visibility, agent activity tracing, input preview, output downloads, sovereignty monitoring, a prototype knowledge base, and a local model registry.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- lucide-react icons
- Native `fetch` and `FormData` for API access

## Setup

From this directory:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

Build the production bundle:

```bash
npm run build
```

Preview the production bundle locally:

```bash
npm run preview
```

## API configuration

The frontend defaults to:

```text
http://localhost:8000
```

To use another backend URL, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

Restart Vite after changing environment variables.

## Views

### Workspace

- Enter a task in the textarea.
- Attach a PDF or image through the file picker or drag-and-drop area.
- Run the task through the local FastAPI `/chat` endpoint.
- Inspect the detected task type and selected model.
- Watch the returned agent steps reveal sequentially.
- Read the response and copy it to the clipboard.
- Download generated local artifacts from `/outputs`.
- Preview attached images directly in the browser; PDFs show a filename placeholder until PDF rendering is added.

### Knowledge Base

This is a clearly labeled static/mock view for the prototype. It shows sample local document records and an upload affordance. Real document ingestion and vector indexing are not connected yet.

### Sovereignty Monitor

Displays live values from `/sovereignty-status` when the backend is reachable:

- External API calls
- Cloud AI requests
- Local model calls
- Local activity log

The event log is static/mock presentation data for the prototype. It does not fabricate external network traffic.

### Models

Loads model names, roles, descriptions, endpoints, and status from `/models`.

## Backend connection

Start the backend separately from the repository root:

```bash
cd ../backend
python -m uvicorn app.main:app --reload --port 8000
```

See [`../backend/README.md`](../backend/README.md) for Python environment setup.

## Authentication limitation

The current backend protects `/chat`, `/upload`, `/outputs`, `/models`, and `/sovereignty-status` with JWT authentication. The current frontend has not yet added a login view or JWT token storage/attachment, so those calls will show the backend error state with `401 Authentication required` against the current authenticated backend.

The API client is intentionally isolated in `src/lib/api.ts`, making it straightforward to add login and an `Authorization: Bearer <token>` header in the next integration step.

## Frontend structure

```text
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
│   ├── layout/
│   ├── ui/
│   └── workspace/
├── lib/
│   ├── api.ts       # API calls and response normalization
│   ├── types.ts     # Shared frontend types
│   └── utils.ts     # Formatting and file helpers
└── views/
    ├── KnowledgeBaseView.tsx
    ├── ModelsView.tsx
    ├── SovereigntyMonitorView.tsx
    └── WorkspaceView.tsx
```

## Notes for extending the frontend

- Keep API calls in `src/lib/api.ts` rather than calling `fetch` inside presentational components.
- Preserve the local-only language and label mock/static functionality honestly.
- Use the existing slate/navy token system and teal accent for active/success states.
- Keep red and amber for errors and warnings only.
- Preserve visible labels, keyboard focus states, and reduced-motion behavior.
- Use `npm run build` after changes to run TypeScript checks and the Vite production build.
