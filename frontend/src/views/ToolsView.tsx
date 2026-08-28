import { CheckCircle2, Wrench, XCircle } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { ToolInfo } from '../lib/api'

interface ToolsViewProps {
  tools: ToolInfo[]
  loading: boolean
}

const FALLBACK_TOOLS: ToolInfo[] = [
  { name: 'Python Sandbox', toolType: 'sandbox', status: 'online', networkBlocked: true, description: 'Hardened subprocess — network blocked, cwd jail, resource caps.' },
  { name: 'OCR Engine', toolType: 'ocr', status: 'online', networkBlocked: false, description: 'Tesseract — on-device text extraction.' },
  { name: 'Document Generator', toolType: 'document-gen', status: 'online', networkBlocked: false, description: 'python-docx — MRPL-branded Word deliverables.' },
  { name: 'Vector Store', toolType: 'rag', status: 'online', networkBlocked: false, description: 'ChromaDB + all-MiniLM-L6-v2 — local retrieval.' },
  { name: 'Artifact Verifier', toolType: 'verification', status: 'online', networkBlocked: false, description: 'Re-execution + structural checks with SHA-256.' },
  { name: 'Local Model', toolType: 'model', status: 'online', networkBlocked: false, description: 'Qwen3-8B-Q4_K_M via llama.cpp — air-gapped.' },
]

const TYPE_COLORS: Record<string, string> = {
  sandbox: 'border-purple-500/30 bg-purple-500/8 text-purple-400',
  ocr: 'border-warning/30 bg-warning/8 text-warning',
  'document-gen': 'border-blue-500/30 bg-blue-500/8 text-blue-400',
  rag: 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400',
  verification: 'border-signal/30 bg-signal/8 text-signal',
  model: 'border-signal/30 bg-signal/8 text-signal',
}

export function ToolsView({ tools, loading }: ToolsViewProps) {
  const display = tools.length > 0 ? tools : FALLBACK_TOOLS

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl">
        <div>
          <div className="eyebrow mb-1">Control plane</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Tool Registry</h2>
          <p className="mt-1 text-xs text-muted">
            Local tools wired into the agent pipeline. Availability is probed live — no external services.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon icon={Wrench} size={13} className="animate-pulse text-signal" />
            Probing tool availability…
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {display.map((tool) => {
            const online = tool.status === 'online'
            return (
              <div key={tool.name} className="border border-line bg-panel/60 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center border border-line bg-ink/40 text-signal">
                      <Icon icon={Wrench} size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-100">{tool.name}</div>
                      <span className={`mt-1 inline-block border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${TYPE_COLORS[tool.toolType] ?? 'border-line text-muted'}`}>
                        {tool.toolType}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={online ? CheckCircle2 : XCircle} size={13} className={online ? 'text-signal' : 'text-danger'} />
                    <span className={`font-mono text-[9px] ${online ? 'text-signal' : 'text-danger'}`}>{online ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                </div>

                <p className="mt-3 text-[10px] leading-4 text-muted">{tool.description}</p>

                <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Network</span>
                  <span className={`font-mono text-[9px] ${tool.networkBlocked ? 'text-signal' : 'text-slate-600'}`}>
                    {tool.networkBlocked ? 'BLOCKED' : 'N/A'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
