from pydantic import BaseModel, Field


class ModelEntry(BaseModel):
    model_config = {"protected_namespaces": ()}

    role: str
    name: str
    endpoint: str
    model_id: str = ""
    format: str = "GGUF"
    quantization: str = "Q4_K_M"
    vram_gb: float | None = None
    context_tokens: int | None = None
    capabilities: list[str] = Field(default_factory=list)
    description: str = ""
