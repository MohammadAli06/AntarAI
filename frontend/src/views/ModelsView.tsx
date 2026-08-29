import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, Cpu, ExternalLink, Info, Pencil, Plus, RefreshCw, Server, Trash2, Zap } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { ModelInfo } from '../lib/types'
import { addModel, fetchLocalModelFiles, inspectLocalModelFile, reloadModels, removeModel, updateModelEndpoint } from '../lib/api'
import type { ModelFileInfo } from '../lib/api'

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

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export function ModelsView({ models, loading, error, isAdmin = false, onChanged }: ModelsViewProps) {
  const displayModels = models
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: 'general', model_path: '', endpoint: 'http://127.0.0.1:8081/completion', model_id: '', description: '', capabilities: '', runtime_context_tokens: '4096', load_policy: 'on_demand', priority: '100', gpu_node: 'local' })
  const [modelFiles, setModelFiles] = useState<ModelFileInfo[]>([])
  const [detected, setDetected] = useState<ModelFileInfo['metadata'] | null>(null)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [endpointEditor, setEndpointEditor] = useState<{ role: string; endpoint: string } | null>(null)

  useEffect(() => {
    if (!showForm) return
    void fetchLocalModelFiles().then(setModelFiles).catch((error) => setActionError(error instanceof Error ? error.message : 'Could not list local GGUF files'))
  }, [showForm])

  async function selectModelFile(modelPath: string) {
    setForm((previous) => ({ ...previous, model_path: modelPath }))
    setDetected(null)
    if (!modelPath) return
    try { setDetected(await inspectLocalModelFile(modelPath)) }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not inspect GGUF metadata') }
  }

  async function submitModel(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setActionError('')
    try {
      await addModel({ ...form, runtime_context_tokens: Number(form.runtime_context_tokens), priority: Number(form.priority), capabilities: form.capabilities.split(',').map((v) => v.trim()).filter(Boolean) })
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

  async function saveEndpoint() {
    if (!endpointEditor) return
    setSaving(true); setActionError('')
    try {
      await updateModelEndpoint(endpointEditor.role, endpointEditor.endpoint.trim())
      setEndpointEditor(null)
      await onChanged?.()
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not update model endpoint') }
    finally { setSaving(false) }
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
          <div className="sm:col-span-2 border border-line/60 bg-ink/25 p-3">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted">Model file — local GGUF</div>
            <select required value={form.model_path} onChange={(event) => void selectModelFile(event.target.value)} className="control-input w-full px-3 py-2 text-xs">
              <option value="">Select a file from backend/models</option>
              {modelFiles.map((file) => <option key={file.path} value={file.path} disabled={Boolean(file.error)}>{file.path}{file.error ? ' (unreadable)' : ''}</option>)}
            </select>
            {modelFiles.length === 0 && <div className="mt-2 text-[10px] text-warning">Place a .gguf file under backend/models to register it.</div>}
          </div>
          {detected && <div className="sm:col-span-2 grid grid-cols-2 gap-px border border-signal/25 bg-line/40 sm:grid-cols-4">{[
            ['Name', detected.name], ['Format', detected.format], ['Quantization', detected.quantization], ['Architecture', detected.architecture],
            ['Parameters', detected.parameter_count], ['Model max context', detected.model_context_tokens ? `${Math.round(detected.model_context_tokens / 1024)}K` : '—'], ['File size', formatBytes(detected.file_size_bytes)], ['Tensors', detected.tensor_count?.toLocaleString()],
          ].map(([label, value]) => <div key={label} className="bg-panel/80 px-3 py-2"><div className="font-mono text-[8px] uppercase text-slate-600">{label}</div><div className="mt-0.5 truncate text-[10px] text-slate-200">{value || '—'}</div></div>)}</div>}
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="control-input w-full px-3 py-2 text-xs"><option value="general">General</option><option value="coder">Coder</option><option value="vision">Vision</option></select></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Endpoint / node</span><input required value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Runtime context</span><input required type="number" min="256" value={form.runtime_context_tokens} onChange={(event) => setForm({ ...form, runtime_context_tokens: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Load policy</span><select value={form.load_policy} onChange={(event) => setForm({ ...form, load_policy: event.target.value })} className="control-input w-full px-3 py-2 text-xs"><option value="on_demand">On demand</option><option value="always_loaded">Always loaded</option><option value="manual">Manual</option></select></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">GPU node</span><input value={form.gpu_node} onChange={(event) => setForm({ ...form, gpu_node: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Priority</span><input required type="number" min="0" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Capabilities</span><input value={form.capabilities} onChange={(event) => setForm({ ...form, capabilities: event.target.value })} placeholder="reasoning, document-analysis" className="control-input w-full px-3 py-2 text-xs" /></label>
          <label><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Model ID (optional)</span><input value={form.model_id} onChange={(event) => setForm({ ...form, model_id: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <label className="sm:col-span-2"><span className="mb-1 block font-mono text-[9px] uppercase text-muted">Description</span><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <button disabled={saving || !form.model_path} className="border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal sm:col-span-2">{saving ? 'Registering local model…' : 'Register Model'}</button>
        </form>}
        {actionError && <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{actionError}</div>}

        {endpointEditor && <form onSubmit={(event) => { event.preventDefault(); void saveEndpoint() }} className="flex flex-wrap items-end gap-3 border border-signal/30 bg-signal/5 p-4">
          <label className="min-w-[260px] flex-1"><span className="mb-1 block font-mono text-[9px] uppercase text-muted">{ROLE_LABELS[endpointEditor.role] ?? endpointEditor.role} endpoint URL</span><input required type="url" value={endpointEditor.endpoint} onChange={(event) => setEndpointEditor({ ...endpointEditor, endpoint: event.target.value })} className="control-input w-full px-3 py-2 text-xs" /></label>
          <button disabled={saving} className="border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">{saving ? 'Saving…' : 'Save URL'}</button>
          <button type="button" disabled={saving} onClick={() => setEndpointEditor(null)} className="px-3 py-2 text-xs text-muted hover:text-slate-100">Cancel</button>
        </form>}

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
          {displayModels.map((model) => {
            const inspected = model.metadataStatus === 'detected'
            const runtimeContext = model.runtimeContextLength ?? model.contextLength
            return <div key={`${model.role}-${model.name}`} className="border border-line bg-panel/60">
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
                  { label: 'Format', value: inspected ? model.format : 'Not inspected' },
                  { label: 'Quantization', value: inspected ? model.quantization : 'Not inspected' },
                  { label: 'Model VRAM', value: model.estimatedVramGb !== undefined ? `Estimated ~${model.estimatedVramGb} GB` : 'Needs GGUF' },
                  { label: 'Runtime context', value: runtimeContext !== undefined ? `${Math.round(runtimeContext / 1024)}K` : 'Not configured' },
                ].map((spec) => (
                  <div key={spec.label} className="flex flex-col gap-0.5 px-4 py-3">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{spec.label}</span>
                    <span className="font-mono text-xs text-slate-200">{spec.value}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 divide-x divide-y divide-line/40 border-b border-line sm:grid-cols-4">
                {[
                  { label: 'Architecture', value: model.architecture ?? 'Not inspected' },
                  { label: 'Parameters', value: model.parameterCount ?? 'Not inspected' },
                  { label: 'Model max context', value: model.modelContextLength ? `${Math.round(model.modelContextLength / 1024)}K` : 'Not inspected' },
                  { label: 'File / tensors', value: model.fileSizeBytes ? `${formatBytes(model.fileSizeBytes)} · ${model.tensorCount?.toLocaleString() ?? '—'}` : 'Not inspected' },
                ].map((spec) => <div key={spec.label} className="flex flex-col gap-0.5 px-4 py-3"><span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{spec.label}</span><span className="truncate font-mono text-[10px] text-slate-300">{spec.value}</span></div>)}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4">
                <div className="flex flex-wrap gap-1.5">
                  {((model.capabilities && model.capabilities.length > 0) ? model.capabilities : (CAPABILITIES[model.role] ?? [])).map((cap) => (
                    <span key={cap} className="border border-signal/25 bg-signal/5 px-2 py-0.5 font-mono text-[8px] text-signal">
                      ✓ {cap}
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
                  {isAdmin && <button onClick={() => setEndpointEditor({ role: model.role, endpoint: model.endpoint ?? '' })} className="flex items-center gap-1 text-[9px] text-muted hover:text-signal" title="Edit endpoint URL"><Icon icon={Pencil} size={11} /> Edit URL</button>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/50 px-4 py-2 font-mono text-[8px] text-slate-500">
                <span>GPU: <span className="text-slate-300">{model.gpuName ?? 'not detected'}</span>{model.gpuVramGb ? ` · ${model.gpuVramGb} GB` : ''}</span>
                <span>Policy: <span className="text-slate-300">{model.loadPolicy ?? 'on demand'}</span></span>
                <span className={inspected ? 'text-signal' : 'text-warning'}>{inspected ? 'GGUF metadata detected locally' : model.inspectionError ?? 'GGUF metadata not yet inspected'}</span>
              </div>
            </div>
          })}
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
