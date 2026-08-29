import { CheckCircle2, Clock, User, Wrench, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Icon } from '../components/ui/Icon'
import type { ToolInfo } from '../lib/api'
import { toggleTool } from '../lib/api'

interface ToolsViewProps {
  tools: ToolInfo[]
  loading: boolean
  isAdmin?: boolean
  onChanged?: () => Promise<void>
}

const TYPE_COLORS: Record<string, string> = {
  sandbox: 'border-amber-500/30 bg-amber-500/8 text-amber-400',
  ocr: 'border-warning/30 bg-warning/8 text-warning',
  'document-gen': 'border-signal/30 bg-signal/8 text-signal',
  rag: 'border-orange-500/30 bg-orange-500/8 text-orange-400',
  verification: 'border-signal/30 bg-signal/8 text-signal',
  model: 'border-signal/30 bg-signal/8 text-signal',
}

function formatToggleTime(value?: string | null) {
  if (!value) return 'Never changed'
  try { return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return value }
}

export function ToolsView({ tools, loading, isAdmin = false, onChanged }: ToolsViewProps) {
  const display = tools
  const [actionError, setActionError] = useState('')

  async function changeTool(tool: ToolInfo) {
    setActionError('')
    try { await toggleTool(tool.name, !(tool.enabled ?? true)); await onChanged?.() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not update tool') }
  }

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
        {actionError && <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{actionError}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {!loading && display.length === 0 && <div className="text-xs text-muted">No live tool registry data available.</div>}
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
                    <span className={`font-mono text-[9px] ${online ? 'text-signal' : 'text-danger'}`}>{tool.status.toUpperCase()}</span>
                  </div>
                </div>

                <p className="mt-3 text-[10px] leading-4 text-muted">{tool.description}</p>
                {tool.toolType === 'rag' && <div className="mt-2 font-mono text-[9px] text-muted">Corpus: {tool.seeded ? 'SEEDED' : 'EMPTY'}</div>}

                <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2">
                  <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Network</span>
                  <span className={`font-mono text-[9px] ${tool.networkBlocked ? 'text-signal' : 'text-slate-600'}`}>
                    {tool.networkBlocked ? 'BLOCKED' : 'N/A'}
                  </span>
                </div>
                <div className="mt-2 border border-line/50 bg-ink/20 px-2.5 py-2 font-mono text-[8px] text-slate-500">
                  {tool.lastToggledAt ? (
                    <>
                      <div className="flex items-center gap-1.5"><Icon icon={User} size={9} /> Changed by <span className="text-slate-300">{tool.lastToggledBy || 'system'}</span></div>
                      <div className="mt-1 flex items-center gap-1.5"><Icon icon={Clock} size={9} /> {formatToggleTime(tool.lastToggledAt)}</div>
                    </>
                  ) : <span>{formatToggleTime(tool.lastToggledAt)}</span>}
                </div>
                {isAdmin && <button disabled={loading} onClick={() => void changeTool(tool)} className={`mt-3 w-full border px-3 py-2 font-mono text-[9px] ${tool.enabled === false ? 'border-signal/30 text-signal' : 'border-warning/30 text-warning'}`}>{tool.enabled === false ? 'ENABLE TOOL' : 'DISABLE TOOL'}</button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
