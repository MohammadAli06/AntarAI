from pydantic import BaseModel, Field


class ModelEntry(BaseModel):
    model_config = {"protected_namespaces": ()}

    role: str
    endpoint: str
    model_path: str = ""
    name: str = ""
    model_id: str = ""
    capabilities: list[str] = Field(default_factory=list)
    description: str = ""
    runtime_context_tokens: int | None = 4096
    load_policy: str = "on_demand"
    priority: int = 100
    gpu_node: str = "local"
    enabled: bool = True
