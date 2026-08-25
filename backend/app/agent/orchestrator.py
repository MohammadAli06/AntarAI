"""
Agent Orchestrator — drives the multi-step agentic loop.

Takes a user message (and optional file), classifies it, selects a model,
executes tools as needed, and returns a structured result with step traces
for the frontend "Agent Activity" panel.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from app.models.registry import call_model, get_model_for_role
from app.router.router import classify_task
from app.tools.doc_generator import generate_approval_note
from app.tools.code_sandbox import run_code_sandbox


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class AgentResult:
    response: str = ""
    model_used: str = ""
    steps: list[str] = field(default_factory=list)
    generated_file: Optional[str] = None


# ---------------------------------------------------------------------------
# Keywords that trigger tool usage
# ---------------------------------------------------------------------------

_DOC_KEYWORDS = ["generate report", "approval note", "create document",
                 "write report", "draft memo", "generate document", "docx"]

_SANDBOX_KEYWORDS = ["run code", "execute", "sandbox", "run this",
                     "test code", "run script"]


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_agent(message: str, has_file: bool = False,
              filename: Optional[str] = None,
              file_path: Optional[str] = None) -> AgentResult:
    """
    Execute the full agentic pipeline for a single user turn.

    Parameters
    ----------
    message : str
        User's chat message.
    has_file : bool
        Whether a file was attached.
    filename : str | None
        Original filename of attachment.
    file_path : str | None
        Server-side path where the uploaded file was saved.

    Returns
    -------
    AgentResult
        Contains response text, model name, ordered step list, and optional
        path to a generated output file.
    """
    result = AgentResult()
    ts = lambda: time.strftime("%H:%M:%S")

    # ── Step 1: Classify ──────────────────────────────────────────────────
    role = classify_task(message, has_file, filename)
    model_info = get_model_for_role(role)
    result.model_used = model_info["name"]

    result.steps.append(f"[{ts()}] 🔍 Task classified as: {role}")
    result.steps.append(f"[{ts()}] 🤖 Model selected: {model_info['name']}")

    # ── Step 2: Handle file context ───────────────────────────────────────
    if has_file and file_path:
        result.steps.append(f"[{ts()}] 📎 File received: {filename}")
        if role == "vision":
            result.steps.append(f"[{ts()}] 👁️ Sending to vision model for analysis")

    # ── Step 3: Build prompt & call model ─────────────────────────────────
    result.steps.append(f"[{ts()}] 📝 Preparing prompt")

    prompt = _build_prompt(role, message, filename)
    result.steps.append(f"[{ts()}] ⚙️ Calling {model_info['name']} (local, air-gapped)")

    model_response = call_model(role, prompt, image_path=file_path)
    result.steps.append(f"[{ts()}] ✅ Response received from local model")

    result.response = model_response

    # ── Step 4: Tool invocations (conditional) ────────────────────────────
    msg_lower = message.lower()

    # Document generation
    if any(kw in msg_lower for kw in _DOC_KEYWORDS):
        result.steps.append(f"[{ts()}] 📄 Tool: Generating Word document")
        doc_path = generate_approval_note(
            content=model_response,
            filename="generated_report.docx",
        )
        result.generated_file = doc_path
        result.steps.append(f"[{ts()}] 💾 Document saved: {doc_path}")
        result.response += (
            "\n\n---\n📄 **Document generated:** `generated_report.docx` "
            "— available for download from /outputs."
        )

    # Code sandbox execution
    if any(kw in msg_lower for kw in _SANDBOX_KEYWORDS):
        result.steps.append(f"[{ts()}] 🧪 Tool: Running code sandbox")
        sandbox_result = run_code_sandbox(model_response)
        result.steps.append(
            f"[{ts()}] 🧪 Sandbox result: {sandbox_result['status']}"
        )
        result.response += (
            f"\n\n---\n🧪 **Sandbox output:**\n```\n{sandbox_result['stdout']}\n```"
        )

    # ── Step 5: Done ──────────────────────────────────────────────────────
    result.steps.append(f"[{ts()}] 🏁 Task complete — zero external calls made")

    return result


# ---------------------------------------------------------------------------
# Prompt construction helpers
# ---------------------------------------------------------------------------

def _build_prompt(role: str, message: str, filename: str | None = None) -> str:
    """Assemble a role-aware prompt string."""
    system_preamble = {
        "general": (
            "You are AntarAI, a sovereign on-premise AI assistant for MRPL "
            "(Mangalore Refinery and Petrochemicals Ltd). Answer concisely "
            "using only local data. Never reference external APIs."
        ),
        "coder": (
            "You are AntarAI-Coder, an on-premise code assistant. "
            "Write clean, production-grade Python code. Include docstrings."
        ),
        "vision": (
            "You are AntarAI-Vision, an on-premise multimodal assistant. "
            "Analyse the uploaded image or document and extract structured info."
        ),
    }

    parts = [system_preamble.get(role, system_preamble["general"])]
    if filename:
        parts.append(f"\n[Attached file: {filename}]")
    parts.append(f"\nUser: {message}")
    return "\n".join(parts)
