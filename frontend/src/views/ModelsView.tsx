import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, Cpu, ExternalLink, Info, Plus, RefreshCw, Server, Trash2, Zap } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { ModelInfo } from '../lib/types'
import { addModel, reloadModels, removeModel } from '../lib/api'

interface ModelsViewProps {
  models: ModelInfo[]
  loading: boolean
  error?: string
  isAdmin?: boolean
  onChanged?: () => Promise<void>
}

const ROLE_LABELS: Record<string, string> = {
  general: 'General',
  coder: 'Coder',
  vision: 'Vision',
}

const ROLE_COLORS: Record<string, string> = {
  general: 'border-signal/30 bg-signal/8 text-signal',
  coder: 'border-amber-500/30 bg-amber-500/8 text-amber-400',
  vision: 'border-orange-500/30 bg-orange-500/8 text-orange-400',
}

const CAPABILITIES: Record<string, string[]> = {
  general: ['Reasoning', 'Summarization', 'SOP Analysis', 'Document Q&A'],
  coder: ['Python', 'Data Analysis', 'Calculations', 'Sandbox Execution'],
  vision: ['Image Understanding', 'OCR', 'P&ID Reading', 'Chart Analysis'],
}

export function ModelsView({ models, loading, error, isAdmin = false, onChanged }: ModelsViewProps) {
  const displayModels = models
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: '', name: '', endpoint: 'http://127.0.0.1:8081/completion', description: '', capabilities: '' })
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitModel(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setActionError('')
    try {
      await addModel({ ...form, capabilities: form.capabilities.split(',').map((v) => v.trim()).filter(Boolean) })
      setShowForm(false)
      await onChanged?.()
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not add model') }
    finally { setSaving(false) }
  }

  async function deleteModel(role: string) {
    if (!window.confirm(`Remove the ${role} model registration?`)) return
    try { await removeModel(role); await onChanged?.() }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not remove model') }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
          <div className="eyebrow mb-1">AI platform</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Model Registry</h2>
          <p className="mt-1 text-xs text-muted">
            On-premise model registry — all models run locally via llama.cpp. Zero cloud dependency.
          </p>
          </div>
          {isAdmin && <div className="flex gap-2"><button onClick={async () => { await reloadModels(); await onChanged?.() }} className="border border-line px-3 py-2 text-xs text-muted hover:text-signal"><Icon icon={RefreshCw} size={12} /></button><button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 border border-signal/30 bg-signal/8 px-3 py-2 text-xs text-signal"><Icon icon={Plus} size={12} /> Add Model</button></div>}
        </div>

        {showForm && <form onSubmit={submitModel} className="grid gap-3 border border-line bg-panel/50 p-4 sm:grid-cols-2">
          {(['role', 'name', 'endpoint', 'description', 'capabilities'] as const).map((field) => <label key={field} className={field === 'description' || field === 'capabilities' ? 'sm:col-span-2' : ''}><span className="mb-1 block font-mono text-[9px] uppercase text-muted">{field}</span><input required={field !== 'description' && field !== 'capabilities'} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>)}
          <button disabled={saving} className="border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal sm:col-span-2">{saving ? 'Validating endpoint…' : 'Register Model'}</button>
        </form>}
        {actionError && <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{actionError}</div>}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon icon={Zap} size={13} className="animate-pulse text-signal" />
            Loading model registry…
          </div>
        )}

        {error && (
          <div className="border border-warning/30 bg-warning/8 px-4 py-3 text-xs text-warning">
            {error} — live model registry unavailable. Confirm the backend is running on port 8000.
          </div>
        )}

        {/* Model cards */}
        <div className="space-y-4">
          {!loading && displayModels.length === 0 && (
            <div className="border border-line bg-panel/40 p-4 text-xs text-muted">No live model registry data available.</div>
          )}
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
                        <span className={`size-1.5 rounded-full ${model.status === 'online' ? 'bg-signal' : 'bg-danger'}`} />
                        <span className={`font-mono text-[9px] ${model.status === 'online' ? 'text-signal' : 'text-danger'}`}>{model.status === 'online' ? 'READY' : 'OFFLINE'}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-100">{model.name}</div>
                    <div className="text-[10px] text-muted">{model.description}</div>
                  </div>
                </div>
                {isAdmin && model.role !== 'general' && <button onClick={() => void deleteModel(model.role)} className="text-muted hover:text-danger" title="Remove model"><Icon icon={Trash2} size={15} /></button>}
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
