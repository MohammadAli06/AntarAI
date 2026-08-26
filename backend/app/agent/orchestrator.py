"""
Agent Orchestrator — drives the multi-step agentic loop.

All model calls are now real — routed to Qwen3-8B-Q4_K_M via llama.cpp.
OCR is performed locally via Tesseract before sending to Qwen.
Code is executed in a real subprocess sandbox.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

from app.models.registry import call_model, get_model_for_role
from app.router.router import classify_task
from app.tools.doc_generator import generate_approval_note
from app.tools.code_sandbox import run_code_sandbox
from app.tools.ocr_extractor import (
    build_extraction_prompt,
    extract_text,
    parse_extraction_response,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class AgentResult:
    response: str = ""
    model_used: str = ""
    steps: list[str] = field(default_factory=list)
    generated_file: Optional[str] = None
    extracted_fields: Optional[dict] = None   # structured fields from OCR extraction


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
]


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_agent(
    message: str,
    has_file: bool = False,
    filename: Optional[str] = None,
    file_path: Optional[str] = None,
) -> AgentResult:
    """
    Execute the full agentic pipeline for a single user turn.

    Flow:
      1. Classify task → role
      2. If file attached → extract text via OCR
      3. Build prompt (OCR text injected for vision/document tasks)
      4. Call Qwen3-8B via llama.cpp
      5. If doc generation requested → generate .docx
      6. If code execution requested → run sandbox
      7. Return AgentResult with steps trace
    """
    result = AgentResult()
    ts = lambda: time.strftime("%H:%M:%S")
    msg_lower = message.lower()

    # ── Step 1: Classify ──────────────────────────────────────────────────
    role = classify_task(message, has_file, filename)
    model_info = get_model_for_role(role)
    result.model_used = model_info["name"]

    result.steps.append(f"[{ts()}] Task classified as: {role.upper()}")
    result.steps.append(f"[{ts()}] Model selected: {model_info['name']} (local, air-gapped)")

    # ── Step 2: File handling + OCR ───────────────────────────────────────
    extracted_text = ""
    if has_file and file_path:
        result.steps.append(f"[{ts()}] File received: {filename}")
        result.steps.append(f"[{ts()}] Running local OCR / text extraction...")
        try:
            extracted_text = extract_text(file_path)
            preview = extracted_text[:80].replace("\n", " ")
            result.steps.append(f"[{ts()}] OCR complete — {len(extracted_text)} chars extracted")
            result.steps.append(f"[{ts()}] Preview: \"{preview}...\"")
        except Exception as exc:
            logger.warning("OCR failed: %s", exc)
            result.steps.append(f"[{ts()}] OCR warning: {exc}")
            extracted_text = f"[OCR unavailable: {exc}]"

    # ── Step 3: Build prompt ───────────────────────────────────────────────
    result.steps.append(f"[{ts()}] Preparing prompt for Qwen3-8B...")

    if extracted_text and role == "vision":
        # Use the structured extraction prompt for document analysis
        prompt = build_extraction_prompt(extracted_text, message)
        result.steps.append(f"[{ts()}] Using structured extraction prompt")
    else:
        prompt = _build_prompt(role, message, filename, extracted_text)

    # ── Step 4: Call Qwen3-8B ─────────────────────────────────────────────
    result.steps.append(f"[{ts()}] Calling Qwen3-8B-Q4_K_M @ 127.0.0.1:8081...")

    try:
        # Longer context for code tasks
        n_predict = 1024 if role == "coder" else 512
        model_response = call_model(role, prompt, n_predict=n_predict)
        result.steps.append(f"[{ts()}] Response received — {len(model_response)} chars")
    except RuntimeError as exc:
        error_msg = str(exc)
        result.steps.append(f"[{ts()}] ERROR: {error_msg}")
        result.response = f"**Model Error:** {error_msg}\n\nPlease ensure the llama-server is running on 127.0.0.1:8081."
        result.steps.append(f"[{ts()}] Pipeline halted due to model error")
        return result

    result.response = model_response

    # ── Step 5: Parse structured fields (vision/doc analysis) ────────────
    if extracted_text and role == "vision":
        fields = parse_extraction_response(model_response)
        result.extracted_fields = fields
        result.steps.append(f"[{ts()}] Structured fields parsed: {list(fields.keys())}")

        # Format a clean response for the frontend
        result.response = _format_extraction_response(model_response, fields)

    # ── Step 6: Document generation ───────────────────────────────────────
    if any(kw in msg_lower for kw in _DOC_KEYWORDS):
        result.steps.append(f"[{ts()}] Tool: Generating MRPL approval note (Word)...")
        try:
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            doc_filename = f"approval_note_{timestamp}.docx"
            doc_path = generate_approval_note(
                content=model_response,
                filename=doc_filename,
                extracted_fields=result.extracted_fields,
            )
            result.generated_file = doc_path
            result.steps.append(f"[{ts()}] Document saved: {doc_path}")
            result.response += (
                f"\n\n---\n**Document generated:** `{doc_path}` "
                "— available for download from the Outputs panel."
            )
        except Exception as exc:
            logger.error("Document generation failed: %s", exc)
            result.steps.append(f"[{ts()}] Document generation error: {exc}")

    # ── Step 7: Code sandbox ──────────────────────────────────────────────
    if any(kw in msg_lower for kw in _SANDBOX_KEYWORDS) and role == "coder":
        result.steps.append(f"[{ts()}] Tool: Running code in local subprocess sandbox...")
        sandbox_result = run_code_sandbox(model_response)
        result.steps.append(
            f"[{ts()}] Sandbox: {sandbox_result['status'].upper()} "
            f"(exit {sandbox_result.get('exit_code', '?')})"
        )
        if sandbox_result["stdout"]:
            result.response += f"\n\n---\n**Sandbox Output:**\n```\n{sandbox_result['stdout']}\n```"
        if sandbox_result["stderr"]:
            result.response += f"\n**Stderr:**\n```\n{sandbox_result['stderr']}\n```"
        if sandbox_result["status"] == "timeout":
            result.response += "\n\n> Execution timed out after 10 seconds."

    # ── Step 8: Done ──────────────────────────────────────────────────────
    result.steps.append(f"[{ts()}] Task complete — all processing on-premise, zero external calls")

    return result


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _build_prompt(
    role: str,
    message: str,
    filename: Optional[str],
    extracted_text: str = "",
) -> str:
    """Assemble a Qwen3 chat-format prompt string."""

    system_prompts = {
        "general": (
            "You are AntarAI, a sovereign on-premise AI assistant for MRPL "
            "(Mangalore Refinery and Petrochemicals Ltd). "
            "Answer concisely and accurately. "
            "You run fully locally — never reference external services or the internet."
        ),
        "coder": (
            "You are AntarAI-Coder, an on-premise Python code assistant for MRPL engineers. "
            "Write clean, production-grade Python code with docstrings. "
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
    user_parts.append(message)

    user_content = "\n\n".join(user_parts)

    # Qwen3 chat format
    return (
        f"<|im_start|>system\n{system}<|im_end|>\n"
        f"<|im_start|>user\n{user_content}<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


def _format_extraction_response(raw_response: str, fields: dict) -> str:
    """Format parsed extraction fields into a clean markdown response."""
    lines = ["**Extracted Information from Document:**\n"]
    field_labels = {
        "inspection_id": "Inspection ID",
        "equipment": "Equipment",
        "inspection_date": "Inspection Date",
        "finding": "Finding",
        "severity": "Severity",
        "recommended_action": "Recommended Action",
        "summary": "Summary",
    }
    for key, label in field_labels.items():
        value = fields.get(key, "N/A")
        if value and value != "N/A":
            if key == "severity":
                icon = {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "⛔"}.get(
                    value.lower(), "⚪"
                )
                lines.append(f"**{label}:** {icon} {value}")
            else:
                lines.append(f"**{label}:** {value}")
    return "\n".join(lines)
