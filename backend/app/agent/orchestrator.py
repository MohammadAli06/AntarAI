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
from app.tools.registry import is_tool_enabled
from app.rag.ingestor import retrieve_sources
from app.sovereignty.inspector import sha256_file, record_blocked_attempt
from app.system_log import log_event
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
    yield _ev("plan.created", {
        "objective": message,
        "stages": (["route", "ocr"] if has_file else ["route"]) + ["knowledge", "model", "verification", "artifact", "approval"],
    }, step_id="plan")

    # ── 2. Router ─────────────────────────────────────────────────────────
    yield _ev("router.started", step_id="route")
    role = classify_task(message, has_file, filename)
    model_info = get_model_for_role(role)
    model_route = _build_model_route(message, has_file, role, model_info)
    log_event("INFO", f"Router → role={role} model={model_info['name']}")
    yield _ev("router.completed", {
        "role": role,
        "model": model_info["name"],
        "endpoint": model_info.get("endpoint"),
        "risk": _risk_for(role, False),
        "routeReason": f"Matched the request to the {role} capability route",
        "modelRoute": model_route,
    }, step_id="route")

    # ── 3. OCR (if file) ──────────────────────────────────────────────────
    extracted_text = ""
    if has_file and file_path:
        yield _ev("ocr.started", step_id="ocr")
        if not is_tool_enabled("ocr"):
            extracted_text = "[OCR disabled by administrator]"
            yield _ev("ocr.completed", {"ocrResult": _build_ocr_result(extracted_text, filename, ok=False), "reason": "OCR disabled by administrator"}, step_id="ocr")
        else:
            try:
                extracted_text = extract_text(file_path)
                ocr_ok = bool(extracted_text.strip()) and not extracted_text.lstrip().startswith("[")
                yield _ev("ocr.completed", {"ocrResult": _build_ocr_result(extracted_text, filename, ok=ocr_ok), "reason": None if ocr_ok else extracted_text.strip("[] ")},
                          step_id="ocr")
            except Exception as exc:
                logger.warning("OCR failed: %s", exc)
                extracted_text = f"[OCR unavailable: {exc}]"
                yield _ev("ocr.completed", {"ocrResult": _build_ocr_result(extracted_text, filename, ok=False)},
                          step_id="ocr")

    # ── 4. RAG retrieval ──────────────────────────────────────────────────
    yield _ev("knowledge.started", step_id="knowledge")
    sources: list[dict] = []
    # A code-only request has no document-grounding requirement. Retrieving
    # from the general corpus here only produces accidental keyword matches
    # (for example, invoice numbers appearing beside a Python request).
    if role != "coder" and is_tool_enabled("rag"):
        try:
            sources = retrieve_sources(message, n_results=3)
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s", exc)
    elif role == "coder":
        log_event("RETR", "Knowledge retrieval skipped for code task")
    log_event("RETR", f"Vector search complete — {len(sources)} sources retrieved")
    yield _ev("knowledge.completed", {"sources": sources}, step_id="knowledge")

    # ── 5. Build prompt (inject RAG context) ──────────────────────────────
    if extracted_text and role == "vision":
        prompt = build_extraction_prompt(extracted_text, message)
    else:
        prompt = _build_prompt(role, message, filename, extracted_text, sources)

    # ── 6. Model call ─────────────────────────────────────────────────────
    yield _ev("model.started", {"model": model_info["name"], "role": role}, step_id="model")
    if not is_tool_enabled("model"):
        error = "Local Model disabled by administrator"
        yield _ev("model.failed", {"error": error}, step_id="model")
        yield _ev("task.failed", {"error": error, "response": f"**Model Error:** {error}"})
        return
    _model_start = time.monotonic()
    try:
        # Code artifacts can be several hundred lines.  Leave enough space for
        # a complete closing fence and avoid handing a truncated script to the
        # sandbox.
        n_predict = 2048 if role == "coder" else 512
        model_response = call_model(role, prompt, n_predict=n_predict)
    except RuntimeError as exc:
        log_event("ERROR", f"Model call failed: {exc}")
        yield _ev("model.failed", {"error": str(exc)}, step_id="model")
        yield _ev("task.failed", {"error": str(exc), "response":
            f"**Model Error:** {exc}\n\nEnsure llama-server is running on 127.0.0.1:8081."})
        return
    _model_ms = int((time.monotonic() - _model_start) * 1000)
    log_event("INFER", f"Inference complete ({model_info['name']}). Latency: {_model_ms/1000:.2f}s  chars: {len(model_response)}")
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
        if not is_tool_enabled("document-gen"):
            yield _ev("tool.failed", {"toolRun": {"toolName": "Document Generator", "toolType": "document-gen", "status": "failed", "networkBlocked": True, "error": "Document Generator disabled by administrator"}}, step_id="tool-doc")
        else:
            try:
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                doc_filename = f"approval_note_{timestamp}.docx"
                generate_approval_note(content=model_response, filename=doc_filename, extracted_fields=extracted_fields)
                generated_file = doc_filename
                tool_runs.append({"toolName": "Document Generator", "toolType": "document-gen", "status": "completed", "networkBlocked": True, "outputPreview": doc_filename})
                log_event("TOOL", f"Document generated: {doc_filename}")
                yield _ev("tool.completed", {"toolRun": tool_runs[-1]}, step_id="tool-doc")
            except Exception as exc:
                logger.error("Document generation failed: %s", exc)
                yield _ev("tool.failed", {"toolRun": {"toolName": "Document Generator", "toolType": "document-gen", "status": "failed", "networkBlocked": True, "error": str(exc)}}, step_id="tool-doc")

    # ── 9. Code sandbox ──────────────────────────────────────────────────
    sandbox_result: Optional[dict] = None
    if any(kw in msg_lower for kw in _SANDBOX_KEYWORDS) and role == "coder":
        yield _ev("tool.started", {"toolName": "Python Sandbox"}, step_id="tool-sandbox")
        if not is_tool_enabled("sandbox"):
            yield _ev("tool.failed", {"toolRun": {"toolName": "Python Sandbox", "toolType": "sandbox", "status": "failed", "networkBlocked": True, "error": "Python Sandbox disabled by administrator"}}, step_id="tool-sandbox")
            sandbox_result = None
        else:
            sandbox_result = run_code_sandbox(model_response)
        if sandbox_result is None:
            pass
        else:
            if sandbox_result.get("egress_attempted"):
                record_blocked_attempt()
            tool_run = {"toolName": "Python Sandbox", "toolType": "sandbox", "status": "completed" if sandbox_result["status"] == "passed" else "failed", "networkBlocked": True, "exitCode": sandbox_result.get("exit_code"), "codeFile": sandbox_result.get("code_file"), "code": sandbox_result.get("code"), "stdout": sandbox_result.get("stdout"), "stderr": sandbox_result.get("stderr"), "outputPreview": (sandbox_result.get("stdout", "") or sandbox_result.get("stderr", "") or "")[:200], "durationMs": sandbox_result.get("duration_ms")}
            tool_runs.append(tool_run)
            yield _ev("tool.completed", {"toolRun": tool_run}, step_id="tool-sandbox")
            if not generated_file and sandbox_result.get("code_file"):
                generated_file = sandbox_result["code_file"]

    # ── 10. Verification ─────────────────────────────────────────────────
    yield _ev("verification.started", step_id="verification")
    if not is_tool_enabled("verification"):
        verification = {"passed": False, "confidence": 0.0, "summary": "Artifact Verifier disabled by administrator", "checks": []}
    else:
        try:
            verification = verify_artifact(
                artifact_path=generated_file,
                model_response=model_response,
                role=role,
                sources_count=len(sources),
                task_type=role,
                model_name=model_info["name"],
                model_endpoint=model_info.get("endpoint", "local"),
            )
        except Exception as exc:
            logger.error("Verification failed: %s", exc)
            verification = {
                "passed": False, "confidence": 0.0,
                "summary": f"Verification error: {exc}", "checks": [],
            }
    conf = verification.get('confidence', 0)
    passed = verification.get('passed', False)
    log_event(
        "INFO" if passed else "WARN",
        f"Verification {'PASS' if passed else 'FAIL'} — confidence={conf:.2f}",
    )
    yield _ev("verification.completed", {"verification": verification}, step_id="verification")

    # ── 11. Artifact ─────────────────────────────────────────────────────
    artifact: Optional[dict] = None
    if generated_file:
        artifact = _build_artifact(generated_file)
        yield _ev("artifact.created", {"artifact": artifact}, step_id="artifact")

    # ── 12. Approval gate ────────────────────────────────────────────────
    # Policy (policies.yaml): auto_approve requires risk=low, all checks
    # passed, and confidence >= 0.90. Everything else — high/critical risk,
    # failed checks, low confidence — goes to the Approval Queue.
    # NOTE: coder tasks are classified as medium risk by _risk_for(), so
    # they already fail the max_risk:low threshold without a special case.
    risk = _risk_for(role, bool(generated_file), generated_file)
    requires_approval = not (
        risk == "low"
        and verification.get("passed", False)
        and verification.get("confidence", 0) >= 0.90
    )
    if requires_approval:
        log_event("WARN", f"Task requires approval — risk={risk} confidence={verification.get('confidence', 0):.2f}")
    else:
        log_event("INFO", f"Task auto-approved — risk={risk} confidence={verification.get('confidence', 0):.2f}")
    final_status = "pending_approval" if requires_approval else "completed"

    result_payload = {
        "response": model_response,
        "generatedFile": generated_file,
        "modelUsed": model_info["name"],
        "role": role,
        "risk": risk,
        "evidenceCount": len(sources),
        "modelRunId": f"{model_info['name']}@{model_info.get('endpoint', 'local')}",
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

    scores = {
        "vision": 0.94 if has_file else 0.35,
        "coder": 0.90 if any(k in msg_lower for k in ("code", "python", "script", "calculate")) else 0.40,
        "general": 0.80,
    }
    candidates = []
    for candidate_role in ("vision", "coder", "general"):
        configured = get_model_for_role(candidate_role)
        candidates.append({
            "modelName": configured["name"],
            "role": candidate_role,
            "score": scores[candidate_role],
            "endpoint": configured.get("endpoint"),
        })
    selected_role = role
    for c in candidates:
        if c["role"] == selected_role:
            selected = c
            break
    else:
        selected = candidates[-1]
    selected = {**selected, "modelName": model_info["name"], "endpoint": model_info.get("endpoint")}
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
    sheets = text.count("--- Sheet:") if ok else 0
    pages = (0 if sheets else max(1, text.count("--- Page") + (1 if text and "--- Page" not in text else 0))) if ok else 0
    text_blocks = max(1, text.count("\n\n") + 1) if text and ok else 0
    return {
        "pages": pages,
        "sheets": sheets,
        "textBlocks": text_blocks,
        "tables": 0,
        "succeeded": bool(ok),
        "confidence": None,
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


def _risk_for(role: str, generates_file: bool, generated_file: Optional[str] = None) -> str:
    if generated_file and str(generated_file).lower().endswith(".docx"):
        return "high"  # Formal Word Approval Note Deliverable
    if role == "coder":
        return "medium"  # Code execution task (runs in sandbox)
    if generates_file:
        return "high"
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
            "For code that will be executed, return exactly one complete Python source block: "
            "put ```python on a line by itself before the first code line and ``` on a line by itself after the final code line. "
            "Do not put prose, Markdown, or an explanation inside the block, and always close triple-quoted strings, brackets, and the code fence. "
            "Keep the script self-contained, use only the Python standard library unless the user explicitly supplies a dependency, "
            "and print a short result so sandbox execution can be verified."
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
