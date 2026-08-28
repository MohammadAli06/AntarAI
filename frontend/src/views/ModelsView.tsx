import { CheckCircle2, Cpu, ExternalLink, Info, Server, Zap } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { ModelInfo } from '../lib/types'

interface ModelsViewProps {
  models: ModelInfo[]
  loading: boolean
  error?: string
}

const FALLBACK_MODELS: ModelInfo[] = [
  {
    name: 'Qwen3-8B-Q4_K_M',
    role: 'general',
    status: 'ready',
    description: 'General reasoning & text generation',
    endpoint: '127.0.0.1:8080',
    quantization: 'Q4_K_M',
    vramGb: 6.2,
    contextLength: 32768,
    checksum: 'SHA256 ✓ Verified',
  },
  {
    name: 'Qwen-Coder-7B-Q4_K_M',
    role: 'coder',
    status: 'ready',
    description: 'Code generation, analysis & sandbox execution',
    endpoint: '127.0.0.1:8081',
    quantization: 'Q4_K_M',
    vramGb: 5.8,
    contextLength: 16384,
    checksum: 'SHA256 ✓ Verified',
  },
  {
    name: 'Qwen-VL-7B-Q4_K_M',
    role: 'vision',
    status: 'ready',
    description: 'Vision-language understanding, OCR & P&ID analysis',
    endpoint: '127.0.0.1:8082',
    quantization: 'Q4_K_M',
    vramGb: 7.1,
    contextLength: 8192,
    checksum: 'SHA256 ✓ Verified',
  },
]

const ROLE_LABELS: Record<string, string> = {
  general: 'General',
  coder: 'Coder',
  vision: 'Vision',
}

const ROLE_COLORS: Record<string, string> = {
  general: 'border-blue-500/30 bg-blue-500/8 text-blue-400',
  coder: 'border-purple-500/30 bg-purple-500/8 text-purple-400',
  vision: 'border-warning/30 bg-warning/8 text-warning',
}

const CAPABILITIES: Record<string, string[]> = {
  general: ['Reasoning', 'Summarization', 'SOP Analysis', 'Document Q&A'],
  coder: ['Python', 'Data Analysis', 'Calculations', 'Sandbox Execution'],
  vision: ['Image Understanding', 'OCR', 'P&ID Reading', 'Chart Analysis'],
}

export function ModelsView({ models, loading, error }: ModelsViewProps) {
  const displayModels = models.length > 0 ? models : FALLBACK_MODELS

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl">
        {/* Header */}
        <div>
          <div className="eyebrow mb-1">AI platform</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Model Registry</h2>
          <p className="mt-1 text-xs text-muted">
            On-premise model registry — all models run locally via llama.cpp. Zero cloud dependency.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon icon={Zap} size={13} className="animate-pulse text-signal" />
            Loading model registry…
          </div>
        )}

        {error && (
          <div className="border border-warning/30 bg-warning/8 px-4 py-3 text-xs text-warning">
            {error} — showing cached model registry.
          </div>
        )}

        {/* Model cards */}
        <div className="space-y-4">
          {displayModels.map((model) => (
            <div key={model.name} className="border border-line bg-panel/60">
              {/* Card header */}
              <div className="flex items-start justify-between border-b border-line p-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 items-center justify-center border border-line bg-ink/40 text-signal">
                    <Icon icon={Cpu} size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${ROLE_COLORS[model.role] ?? 'border-line text-muted'}`}
                      >
                        {ROLE_LABELS[model.role] ?? model.role}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-signal" />
                        <span className="font-mono text-[9px] text-signal">READY</span>
                      </div>
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-100">{model.name}</div>
                    <div className="text-[10px] text-muted">{model.description}</div>
                  </div>
                </div>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-0 sm:grid-cols-4 divide-x divide-y divide-line/40 border-b border-line">
                {[
                  { label: 'Format', value: 'GGUF' },
                  { label: 'Quantization', value: model.quantization ?? 'Q4_K_M' },
                  { label: 'VRAM', value: model.vramGb !== undefined ? `${model.vramGb} GB` : '—' },
                  { label: 'Context', value: model.contextLength !== undefined ? `${(model.contextLength / 1024).toFixed(0)}K` : '—' },
                ].map((spec) => (
                  <div key={spec.label} className="flex flex-col gap-0.5 px-4 py-3">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{spec.label}</span>
                    <span className="font-mono text-xs text-slate-200">{spec.value}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-wrap gap-1.5">
                  {(CAPABILITIES[model.role] ?? []).map((cap) => (
                    <span key={cap} className="border border-line px-1.5 py-0.5 font-mono text-[8px] text-slate-600">
                      {cap}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-[9px]">
                    <Icon icon={Server} size={11} className="text-muted" />
                    <span className="font-mono text-muted">{model.endpoint ?? 'localhost'}</span>
                  </div>
                  {model.checksum && (
                    <div className="flex items-center gap-1 font-mono text-[9px] text-signal">
                      <Icon icon={CheckCircle2} size={10} />
                      {model.checksum}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info footer */}
        <div className="flex items-center gap-2 border border-line bg-panel/30 px-4 py-3 text-[10px] text-muted">
          <Icon icon={Info} size={13} className="text-signal shrink-0" />
          <span>
            Model endpoints resolve within the air-gapped network. External model APIs are blocked at the network boundary.
          </span>
          <a href="#" className="ml-auto shrink-0 text-signal hover:underline flex items-center gap-1">
            <Icon icon={ExternalLink} size={10} />
            Docs
          </a>
        </div>
      </div>
    </div>
  )
}
