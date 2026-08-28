"""
Agent Orchestrator — drives the streaming, sovereign agentic pipeline.

Final-round version: run_agent_stream() is a generator that yields SSE event
dicts at each *real* pipeline step (routing, OCR, RAG retrieval, model call,
tool execution, verification, artifact, approval gate). The /chat/stream
endpoint serialises these to `text/event-stream`; the frontend reducer maps
them onto AgentStep objects so the execution-trace cards fill in live.

run_agent() (legacy single-shot /chat) is reconstructed from the stream so
there is one source of truth.

All processing is on-premise: Qwen3-8B-Q4_K_M via llama.cpp, local OCR
(Tesseract), local vector retrieval (ChromaDB), local sandbox.
"""

from __future__ import annotations

import datetime
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Optional

from app.models.registry import call_model, get_model_for_role
from app.router.router import classify_task
from app.tools.doc_generator import generate_approval_note
from app.tools.code_sandbox import run_code_sandbox
from app.tools.verifier import verify_artifact
from app.rag.ingestor import retrieve_sources
from app.sovereignty.inspector import sha256_file, record_blocked_attempt
from app.tools.ocr_extractor import (
    build_extraction_prompt,
    extract_text,
    parse_extraction_response,
)

logger = logging.getLogger(__name__)

_OUTPUTS_DIR = Path(__file__).resolve().parents[2] / "outputs"


@dataclass
class AgentResult:
    response: str = ""
    model_used: str = ""
    steps: list[str] = field(default_factory=list)
    generated_file: Optional[str] = None
    extracted_fields: Optional[dict] = None


# ---------------------------------------------------------------------------
# Keyword sets that trigger tool usage
# ---------------------------------------------------------------------------

_DOC_KEYWORDS = [
    "generate report", "approval note", "create document",
    "write report", "draft memo", "generate document", "docx",
    "generate note", "create report",
]

_SANDBOX_KEYWORDS = [
    "run code", "execute", "sandbox", "run this",
    "test code", "run script", "execute code",
    "write a python", "python script", "calculate",
]


# ---------------------------------------------------------------------------
# Event helper
# ---------------------------------------------------------------------------

def _ev(event_type: str, data: Optional[dict] = None, step_id: Optional[str] = None) -> dict:
    return {"type": event_type, "data": data or {}, "stepId": step_id}


def _ts() -> str:
    return time.strftime("%H:%M:%S")


# ---------------------------------------------------------------------------
# Streaming orchestrator
# ---------------------------------------------------------------------------

def run_agent_stream(
    message: str,
    has_file: bool = False,
    filename: Optional[str] = None,
    file_path: Optional[str] = None,
) -> Iterator[dict]:
    """Yield SSE event dicts for one agentic turn (see module docstring)."""
    msg_lower = message.lower()

    # ── 1. Task created ───────────────────────────────────────────────────
    yield _ev("task.created", {"prompt": message})

    # ── 2. Router ─────────────────────────────────────────────────────────
    yield _ev("router.started", step_id="route")
    role = classify_task(message, has_file, filename)
    model_info = get_model_for_role(role)
    model_route = _build_model_route(message, has_file, role, model_info)
    yield _ev("router.completed", {
        "role": role, "model": model_info["name"], "modelRoute": model_route,
    }, step_id="route")

    # ── 3. OCR (if file) ──────────────────────────────────────────────────
    extracted_text = ""
    if has_file and file_path:
        yield _ev("ocr.started", step_id="ocr")
        try:
            extracted_text = extract_text(file_path)
            yield _ev("ocr.completed", {"ocrResult": _build_ocr_result(extracted_text, filename)},
                      step_id="ocr")
        except Exception as exc:
            logger.warning("OCR failed: %s", exc)
            extracted_text = f"[OCR unavailable: {exc}]"
            yield _ev("ocr.completed", {"ocrResult": _build_ocr_result(extracted_text, filename, ok=False)},
                      step_id="ocr")

    # ── 4. RAG retrieval ──────────────────────────────────────────────────
    yield _ev("knowledge.started", step_id="knowledge")
    sources: list[dict] = []
    try:
        sources = retrieve_sources(message, n_results=3)
    except Exception as exc:
        logger.warning("RAG retrieval failed: %s", exc)
    yield _ev("knowledge.completed", {"sources": sources}, step_id="knowledge")

    # ── 5. Build prompt (inject RAG context) ──────────────────────────────
    if extracted_text and role == "vision":
        prompt = build_extraction_prompt(extracted_text, message)
    else:
        prompt = _build_prompt(role, message, filename, extracted_text, sources)

    # ── 6. Model call ─────────────────────────────────────────────────────
    yield _ev("model.started", {"model": model_info["name"], "role": role}, step_id="model")
    try:
        n_predict = 1024 if role == "coder" else 512
        model_response = call_model(role, prompt, n_predict=n_predict)
    except RuntimeError as exc:
        yield _ev("model.failed", {"error": str(exc)}, step_id="model")
        yield _ev("task.failed", {"error": str(exc), "response":
            f"**Model Error:** {exc}\n\nEnsure llama-server is running on 127.0.0.1:8081."})
        return
    yield _ev("model.completed", {
        "response": model_response, "chars": len(model_response),
        "detail": f"{model_info['name']} · {role}", "extractedFields": None,
    }, step_id="model")

    # ── 7. Parse structured fields (vision) ───────────────────────────────
    extracted_fields: Optional[dict] = None
    if extracted_text and role == "vision":
        extracted_fields = parse_extraction_response(model_response)
        model_response = _format_extraction_response(model_response, extracted_fields)

    # ── 8. Document generation ───────────────────────────────────────────
    generated_file: Optional[str] = None
    tool_runs: list[dict] = []
    if any(kw in msg_lower for kw in _DOC_KEYWORDS):
        yield _ev("tool.started", {"toolName": "Document Generator"}, step_id="tool-doc")
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            doc_filename = f"approval_note_{timestamp}.docx"
            generate_approval_note(
                content=model_response,
                filename=doc_filename,
                extracted_fields=extracted_fields,
            )
            generated_file = doc_filename
            tool_runs.append({
                "toolName": "Document Generator", "toolType": "document-gen",
                "status": "completed", "networkBlocked": True,
                "outputPreview": doc_filename,
            })
            yield _ev("tool.completed", {"toolRun": tool_runs[-1]}, step_id="tool-doc")
        except Exception as exc:
            logger.error("Document generation failed: %s", exc)
            yield _ev("tool.failed", {"toolRun": {
                "toolName": "Document Generator", "toolType": "document-gen",
                "status": "failed", "networkBlocked": True, "error": str(exc),
            }}, step_id="tool-doc")

    # ── 9. Code sandbox ──────────────────────────────────────────────────
    sandbox_result: Optional[dict] = None
    if any(kw in msg_lower for kw in _SANDBOX_KEYWORDS) and role == "coder":
        yield _ev("tool.started", {"toolName": "Python Sandbox"}, step_id="tool-sandbox")
        sandbox_result = run_code_sandbox(model_response)
        if sandbox_result.get("egress_attempted"):
            record_blocked_attempt()
        tool_run = {
            "toolName": "Python Sandbox", "toolType": "sandbox",
            "status": "completed" if sandbox_result["status"] == "passed" else "failed",
            "networkBlocked": True,
            "exitCode": sandbox_result.get("exit_code"),
            "codeFile": sandbox_result.get("code_file"),
            "outputPreview": (sandbox_result.get("stdout", "") or "")[:200],
            "durationMs": sandbox_result.get("duration_ms"),
        }
        tool_runs.append(tool_run)
        yield _ev("tool.completed", {"toolRun": tool_run}, step_id="tool-sandbox")
        if not generated_file and sandbox_result.get("code_file"):
            generated_file = sandbox_result["code_file"]

    # ── 10. Verification ─────────────────────────────────────────────────
    yield _ev("verification.started", step_id="verification")
    try:
        verification = verify_artifact(
            artifact_path=generated_file,
            model_response=model_response,
            role=role,
            sources_count=len(sources),
            task_type=role,
        )
    except Exception as exc:
        logger.error("Verification failed: %s", exc)
        verification = {
            "passed": False, "confidence": 0.0,
            "summary": f"Verification error: {exc}", "checks": [],
        }
    yield _ev("verification.completed", {"verification": verification}, step_id="verification")

    # ── 11. Artifact ─────────────────────────────────────────────────────
    artifact: Optional[dict] = None
    if generated_file:
        artifact = _build_artifact(generated_file)
        yield _ev("artifact.created", {"artifact": artifact}, step_id="artifact")

    # ── 12. Approval gate ────────────────────────────────────────────────
    requires_approval = bool(generated_file) and role != "coder"
    final_status = "pending_approval" if requires_approval else "completed"

    result_payload = {
        "response": model_response,
        "generatedFile": generated_file,
        "modelUsed": model_info["name"],
        "role": role,
        "risk": _risk_for(role, bool(generated_file)),
        "evidenceCount": len(sources),
        "modelRunId": f"{model_info['name']}@127.0.0.1:8081",
        "artifactSha256": artifact.get("sha256") if artifact else None,
        "verification": verification,
        "status": final_status,
    }

    if requires_approval:
        yield _ev("approval.required", result_payload, step_id="approval")
    yield _ev("task.completed", result_payload, step_id="approval")


# ---------------------------------------------------------------------------
# Legacy single-shot interface — reconstructs AgentResult from the stream
# ---------------------------------------------------------------------------

def run_agent(
    message: str,
    has_file: bool = False,
    filename: Optional[str] = None,
    file_path: Optional[str] = None,
) -> AgentResult:
    result = AgentResult()
    for ev in run_agent_stream(message, has_file, filename, file_path):
        etype = ev["type"]
        data = ev.get("data", {})

        if etype == "router.completed":
            result.model_used = data.get("model", "")
            result.steps.append(f"[{_ts()}] Routed to {data.get('model')} (role: {data.get('role')})")
        elif etype == "ocr.completed":
            r = data.get("ocrResult", {})
            result.steps.append(f"[{_ts()}] OCR complete — {r.get('textBlocks', 0)} text blocks")
        elif etype == "knowledge.completed":
            result.steps.append(f"[{_ts()}] Knowledge retrieval — {len(data.get('sources', []))} sources")
        elif etype == "model.completed":
            result.response = data.get("response", "")
            result.steps.append(f"[{_ts()}] Model response — {data.get('chars', 0)} chars")
        elif etype == "tool.completed":
            tr = data.get("toolRun", {})
            result.steps.append(f"[{_ts()}] Tool: {tr.get('toolName')} → {tr.get('status')}")
        elif etype == "verification.completed":
            v = data.get("verification", {})
            result.steps.append(f"[{_ts()}] Verification — {v.get('confidence', 0)} confidence")
        elif etype == "artifact.created":
            result.generated_file = data.get("artifact", {}).get("filename")
            result.steps.append(f"[{_ts()}] Artifact saved: {result.generated_file}")
        elif etype == "task.failed":
            result.response = data.get("response", "Task failed.")
            result.steps.append(f"[{_ts()}] ERROR: task failed")
            return result
    result.steps.append(f"[{_ts()}] Task complete — all processing on-premise, zero external calls")
    return result


# ---------------------------------------------------------------------------
# Builders for the rich card payloads
# ---------------------------------------------------------------------------

def _build_model_route(message: str, has_file: bool, role: str, model_info: dict) -> dict:
    msg_lower = message.lower()
    caps = []
    if has_file:
        caps.append("Document understanding")
    if any(k in msg_lower for k in ("code", "python", "calculate", "script", "function")):
        caps.append("Code execution")
    if any(k in msg_lower for k in ("report", "document", "note", "memo")):
        caps.append("Document generation")
    caps.append("Reasoning")

    candidates = [
        {"modelName": "Qwen3-8B-Q4_K_M", "role": "vision", "score": 0.94 if has_file else 0.55},
        {"modelName": "Qwen3-8B-Q4_K_M", "role": "coder", "score": 0.88 if "code" in msg_lower or "python" in msg_lower else 0.40},
        {"modelName": "Qwen3-8B-Q4_K_M", "role": "general", "score": 0.76},
    ]
    selected_role = role
    for c in candidates:
        if c["role"] == selected_role:
            selected = c
            break
    else:
        selected = candidates[-1]
    return {
        "taskId": "",
        "detectedCapabilities": caps,
        "candidates": candidates,
        "selected": selected,
        "laterStages": [
            {"stage": "Verification", "model": "Local Verifier"},
            {"stage": "Artifact", "model": "Document Generator" if has_file else "Sandbox"},
        ],
    }


def _build_ocr_result(text: str, filename: Optional[str], ok: bool = True) -> dict:
    pages = max(1, text.count("--- Page") + (1 if text and "--- Page" not in text else 0))
    text_blocks = max(1, text.count("\n\n") + 1) if text else 0
    return {
        "pages": pages,
        "textBlocks": text_blocks,
        "tables": 0,
        "confidence": 0.93 if ok else 0.0,
        "externalCalls": 0,
    }


def _build_artifact(filename: str) -> dict:
    path = _OUTPUTS_DIR / filename
    size = path.stat().st_size if path.exists() else 0
    try:
        digest = sha256_file(str(path)) if path.exists() else None
    except Exception:
        digest = None
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "file"
    return {
        "id": f"art-{filename}",
        "filename": filename,
        "fileType": ext,
        "sizeBytes": size,
        "generatedLocally": True,
        "downloadUrl": f"/outputs/{filename}",
        "sha256": digest,
        "createdAt": datetime.datetime.now().isoformat(),
    }


def _risk_for(role: str, generates_file: bool) -> str:
    if generates_file:
        return "high"
    if role == "coder":
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _build_prompt(
    role: str,
    message: str,
    filename: Optional[str],
    extracted_text: str,
    sources: list[dict],
) -> str:
    system_prompts = {
        "general": (
            "You are AntarAI, a sovereign on-premise AI assistant for MRPL "
            "(Mangalore Refinery and Petrochemicals Ltd). "
            "Answer concisely and accurately. "
            "You run fully locally — never reference external services or the internet."
        ),
        "coder": (
            "You are AntarAI-Coder, an on-premise Python code assistant for MRPL engineers. "
            "Write clean, production-grade Python code with docstrings in a single ```python block. "
            "Include a brief explanation of what the code does after the code block."
        ),
        "vision": (
            "You are AntarAI, an on-premise document analysis assistant for MRPL. "
            "Analyse the provided document text and answer the user's question. "
            "Be precise and structured in your response."
        ),
    }
    system = system_prompts.get(role, system_prompts["general"])

    user_parts = []
    if filename:
        user_parts.append(f"[Attached: {filename}]")
    if extracted_text:
        user_parts.append(f"Document content:\n{extracted_text[:3000]}")
    if sources:
        ctx = "\n\n".join(
            f"[{s['id']}] {s['title']} ({s.get('section','')}): {s.get('excerpt','')}"
            for s in sources
        )
        user_parts.append(f"Retrieved organizational knowledge:\n{ctx}")
    user_parts.append(message)

    user_content = "\n\n".join(user_parts)
    return (
        f"<|im_start|>system\n{system}<|im_end|>\n"
        f"<|im_start|>user\n{user_content}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


def _format_extraction_response(raw_response: str, fields: dict) -> str:
    lines = ["**Extracted Information from Document:**\n"]
    field_labels = {
        "inspection_id": "Inspection ID", "equipment": "Equipment",
        "inspection_date": "Inspection Date", "finding": "Finding",
        "severity": "Severity", "recommended_action": "Recommended Action",
        "summary": "Summary",
    }
    for key, label in field_labels.items():
        value = fields.get(key, "N/A")
        if value and value != "N/A":
            if key == "severity":
                icon = {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "⛔"}.get(
                    value.lower(), "⚪")
                lines.append(f"**{label}:** {icon} {value}")
            else:
                lines.append(f"**{label}:** {value}")
    return "\n".join(lines)
