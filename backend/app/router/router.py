"""
Task Router — classifies incoming user messages to select the right model role.
"""

import re


# Keywords that signal a coding task
_CODE_KEYWORDS = [
    "write code", "python", "function", "script", "class ", "def ",
    "algorithm", "program", "coding", "debug", "compile", "code",
    "implement", "refactor", "unittest", "test case",
]

# File extensions that indicate image / vision input
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}
_DOCUMENT_EXTENSIONS = {".pdf"}


def classify_task(message: str, has_file: bool = False, filename: str | None = None) -> str:
    """
    Classify a user request into a model role.

    Parameters
    ----------
    message : str
        The user's chat message.
    has_file : bool
        Whether a file was attached.
    filename : str | None
        Original name of the attached file (used to detect type).

    Returns
    -------
    str
        One of ``"general"``, ``"coder"``, ``"vision"``.
    """
    # 1. If a file is attached, check its type first
    if has_file and filename:
        ext = _get_extension(filename)
        if ext in _IMAGE_EXTENSIONS or ext in _DOCUMENT_EXTENSIONS:
            return "vision"

    # 2. Check for code-related keywords in the message
    msg_lower = message.lower()
    for kw in _CODE_KEYWORDS:
        if kw in msg_lower:
            return "coder"

    # 3. Default to general reasoning
    return "general"


def _get_extension(filename: str) -> str:
    """Return the lowercased file extension (e.g. '.pdf')."""
    dot = filename.rfind(".")
    if dot == -1:
        return ""
    return filename[dot:].lower()
