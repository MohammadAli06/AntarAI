# Model packages — offline import staging area

Place GGUF model files here to make them available to the sovereign
Model Center (Admin → Model Center → Local Repository).

The Model Admission Pipeline never downloads anything. This directory is
the air-gapped intake point: models arrive via internal repository, USB
package, or vendor-approved media, and are admitted through:

    integrity (SHA-256) → GGUF metadata → hardware fit → policy
    → node selection → port allocation → registration → health check

Naming convention:
    <Model>-<Quant>.gguf     e.g. Qwen3-8B-Q4_K_M.gguf
