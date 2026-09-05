import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Info,
  Loader2,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { ModelInfo } from '../lib/types'
import {
  addModel,
  fetchLocalModelFiles,
  fetchModelCatalog,
  fetchAdmissions,
  inspectLocalModelFile,
  precheckAdmission,
  reloadModels,
  removeModel,
  startAdmission,
  updateModelEndpoint,
} from '../lib/api'
import type {
  AdmissionCheck,
  AdmissionEvent,
  AdmissionPrecheckResult,
  AdmissionRecord,
  CatalogModel,
  ModelFileInfo,
} from '../lib/api'

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

const SOURCE_LABELS: Record<string, string> = {
  catalog: 'Sovereign Catalog',
  local: 'Local GGUF',
  'offline-package': 'Offline Package',
}

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

type TabId = 'installed' | 'catalog' | 'admissions'

// ---------------------------------------------------------------------------
// Wizard state machine
// ---------------------------------------------------------------------------

type WizardState =
  | { step: 'source'; role: string }
  | { step: 'select'; source: string; role: string; catalogKey?: string; modelPath?: string }
  | { step: 'precheck'; source: string; role: string; catalogKey?: string; modelPath?: string; precheck: AdmissionPrecheckResult; prechecking: boolean }
  | { step: 'provision'; source: string; role: string; catalogKey?: string; modelPath?: string; events: AdmissionEvent[]; running: boolean; done?: boolean; failed?: boolean }

export function ModelsView({ models, loading, error, isAdmin = false, onChanged }: ModelsViewProps) {
  const [tab, setTab] = useState<TabId>('installed')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: 'general', model_path: '', endpoint: 'http://127.0.0.1:8081/completion', model_id: '', description: '', capabilities: '', runtime_context_tokens: '4096', load_policy: 'on_demand', priority: '100', gpu_node: 'local' })
  const [modelFiles, setModelFiles] = useState<ModelFileInfo[]>([])
  const [detected, setDetected] = useState<ModelFileInfo['metadata'] | null>(null)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [endpointEditor, setEndpointEditor] = useState<{ role: string; endpoint: string } | null>(null)

  // Model Center state
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [wizard, setWizard] = useState<WizardState | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onlineModels = models.filter((model) => model.status === 'online').length
  const gpuNodes = new Set(models.map((model) => model.gpuNode || model.serve?.node).filter(Boolean)).size

  useEffect(() => {
    if (!showForm) return
    void fetchLocalModelFiles().then(setModelFiles).catch((error) => setActionError(error instanceof Error ? error.message : 'Could not list local GGUF files'))
  }, [showForm])

  useEffect(() => {
    if (!isAdmin) return
    setCatalogLoading(true)
    void fetchModelCatalog()
      .then((res) => {
        setCatalog(res.catalog)
        // The admission wizard needs the same local repository listing as
        // the catalog. Keeping it here also makes Local GGUF work without
        // opening the legacy manual-registration form first.
        setModelFiles(res.local_files)
      })
      .catch(() => {
        setCatalog([])
        setModelFiles([])
      })
      .finally(() => setCatalogLoading(false))
  }, [isAdmin])

  useEffect(() => {
    if (tab !== 'admissions' || !isAdmin) return
    void fetchAdmissions().then(setAdmissions).catch(() => setAdmissions([]))
  }, [tab, isAdmin])

  useEffect(() => () => abortRef.current?.abort(), [])

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
    if (!window.confirm(`Remove the ${role} model registration? The model file is preserved.`)) return
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

  // ── Wizard actions ──────────────────────────────────────────────────────

  function openWizard() {
    setActionError('')
    setWizard({ step: 'source', role: 'general' })
  }

  function chooseSource(source: string) {
    setWizard((prev) => (prev && prev.step === 'source' ? { step: 'select', source, role: prev.role } : prev))
  }

  function chooseCatalogModel(entry: CatalogModel) {
    setActionError('')
    setWizard((prev) => {
      if (!prev || prev.step !== 'select') return prev
      return { step: 'select', source: prev.source, role: entry.capability, catalogKey: entry.key }
    })
  }

  function chooseLocalModel(modelPath: string) {
    setActionError('')
    setWizard((prev) => {
      if (!prev || prev.step !== 'select') return prev
      return { ...prev, modelPath }
    })
  }

  function chooseAdmissionRole(role: string) {
    setWizard((prev) => {
      if (!prev || prev.step !== 'select') return prev
      return { ...prev, role }
    })
  }

  async function runPrecheck() {
    if (!wizard || wizard.step !== 'select') return
    const { source, role, catalogKey, modelPath } = wizard
    setWizard({ step: 'precheck', source, role, catalogKey, modelPath, prechecking: true, precheck: { status: 'failed', passed: 0, total: 0, checks: [], metadata: null, hardware: { ok: false, detail: '…' }, nodes: [] } })
    try {
      const precheck = await precheckAdmission({ source, role, catalog_key: catalogKey, model_path: modelPath })
      setWizard({ step: 'precheck', source, role, catalogKey, modelPath, precheck, prechecking: false })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Admission pre-check failed')
      setWizard((prev) => (prev && prev.step === 'select' ? { step: 'select', source, role, catalogKey, modelPath } : prev))
    }
  }

  async function runProvision() {
    if (!wizard || wizard.step !== 'precheck') return
    const { source, role, catalogKey, modelPath } = wizard
    const entry = catalog.find((c) => c.key === catalogKey)
    setWizard({ step: 'provision', source, role, catalogKey, modelPath, events: [], running: true })
    setActionError('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await startAdmission(
        {
          source,
          role,
          catalog_key: catalogKey,
          model_path: modelPath,
          description: entry?.description ?? '',
          capabilities: entry?.capabilities ?? [],
          runtime_context_tokens: entry?.context ?? 4096,
        },
        (ev) => {
          setWizard((prev) => {
            if (!prev || prev.step !== 'provision') return prev
            return {
              ...prev,
              events: [...prev.events, ev],
              running: ev.type !== 'admission.completed' && ev.type !== 'admission.failed',
              done: ev.type === 'admission.completed',
              failed: ev.type === 'admission.failed',
            }
          })
        },
        controller.signal,
      )
      setWizard((prev) => {
        if (!prev || prev.step !== 'provision') return prev
        const hasDone = prev.events.some((e) => e.type === 'admission.completed')
        const hasFailed = prev.events.some((e) => e.type === 'admission.failed')
        return { ...prev, running: false, done: hasDone, failed: hasFailed }
      })
      await onChanged?.()
      void fetchAdmissions().then(setAdmissions).catch(() => {})
    } catch (err) {
      if (controller.signal.aborted) return
      setActionError(err instanceof Error ? err.message : 'Model admission failed')
      setWizard((prev) => {
        if (!prev || prev.step !== 'provision') return prev
        return { ...prev, running: false, failed: true }
      })
    }
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
              Active routing, governed model admission, and deployment history for the sovereign AI platform.
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={async () => { await reloadModels(); await onChanged?.() }} className="border border-line px-3 py-2 text-xs text-muted hover:text-signal" title="Reload registry">
                <Icon icon={RefreshCw} size={12} />
              </button>
              <button onClick={openWizard} className="flex items-center gap-1.5 border border-signal/30 bg-signal/8 px-3 py-2 text-xs text-signal">
                <Icon icon={ShieldCheck} size={12} /> Admit Model
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className="flex gap-1 border-b border-line">
            {([
              { id: 'installed', label: `Active Models (${models.length})`, icon: Server },
              { id: 'catalog', label: 'Model Center', icon: Package },
              { id: 'admissions', label: 'Deployments', icon: ShieldCheck },
            ] as { id: TabId; label: string; icon: typeof Server }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  tab === t.id ? 'border-signal text-signal' : 'border-transparent text-muted hover:text-slate-200'
                }`}
              >
                <Icon icon={t.icon} size={12} />
                {t.label}
              </button>
            ))}
          </div>
        )}

        {actionError && <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{actionError}</div>}

        {/* ── Wizard ─────────────────────────────────────────────────────── */}
        {wizard && <AdmissionWizard state={wizard} catalog={catalog} modelFiles={modelFiles} onChooseSource={chooseSource} onChooseCatalog={chooseCatalogModel} onChooseLocal={chooseLocalModel} onChooseRole={chooseAdmissionRole} onBack={() => setWizard(null)} onPrecheck={runPrecheck} onProvision={runProvision} onDone={async () => { setWizard(null); await onChanged?.(); setTab('installed') }} />}

        {/* ── Tab: Installed ─────────────────────────────────────────────── */}
        {tab === 'installed' && (
          <>
            <div className="grid grid-cols-3 gap-px border border-line bg-line/40">
              {[
                ['Active models', String(models.length)],
                ['Online', `${onlineModels}/${models.length}`],
                ['GPU nodes', String(gpuNodes)],
              ].map(([label, value]) => (
                <div key={label} className="bg-panel/70 px-4 py-3">
                  <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{label}</div>
                  <div className="mt-1 font-mono text-sm text-slate-100">{value}</div>
                </div>
              ))}
            </div>
            {showForm && <form onSubmit={submitModel} className="grid gap-3 border border-line bg-panel/50 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2 border border-line/60 bg-ink/25 p-3">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted">Manual registration — local GGUF (advanced)</div>
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

            <div className="space-y-4">
              {!loading && models.length === 0 && (
                <div className="border border-line bg-panel/40 p-4 text-xs text-muted">No live model registry data available.</div>
              )}
              {models.map((model) => {
                const inspected = model.metadataStatus === 'detected'
                const runtimeContext = model.runtimeContextLength ?? model.contextLength
                return <div key={`${model.role}-${model.name}`} className="border border-line bg-panel/60">
                  <div className="flex items-start justify-between border-b border-line p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-10 items-center justify-center border border-line bg-ink/40 text-signal">
                        <Icon icon={Cpu} size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${ROLE_COLORS[model.role] ?? 'border-line text-muted'}`}>
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
                    {model.serve?.node && <span>Node: <span className="text-slate-300">{model.serve.node}</span></span>}
                    {model.serve?.port && <span>Port: <span className="text-slate-300">{model.serve.port}</span></span>}
                    {model.serve?.admitted_sha256 && <span className="text-signal" title={model.serve.admitted_sha256}>SHA-256 verified ✓</span>}
                    <span className={inspected ? 'text-signal' : 'text-warning'}>{inspected ? 'GGUF metadata detected locally' : model.inspectionError ?? 'GGUF metadata not yet inspected'}</span>
                  </div>
                </div>
              })}
            </div>

            {isAdmin && (
              <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 border border-line bg-panel/40 px-3 py-2 text-xs text-muted hover:text-slate-200">
                <Icon icon={Plus} size={12} /> {showForm ? 'Hide manual registration' : 'Manual registration (advanced)'}
              </button>
            )}
          </>
        )}

        {/* ── Tab: Model Center ──────────────────────────────────────────── */}
        {tab === 'catalog' && (
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Model Center</div>
              <div className="mt-1 text-xs text-slate-300">Discover, import and admit approved local model packages into AntarAI.</div>
            </div>
            <div className="flex items-center gap-2 border border-line bg-panel/30 px-4 py-3 text-[10px] text-muted">
              <Icon icon={ShieldCheck} size={13} className="text-signal shrink-0" />
              <span>
                Curated open-weight models pre-approved for admission. AntarAI never downloads at runtime — packages are imported offline and admitted through integrity, policy and hardware-fit gates.
              </span>
            </div>
            {catalogLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted"><Icon icon={Loader2} size={13} className="animate-spin text-signal" /> Loading catalog…</div>
            ) : catalog.length === 0 ? (
              <div className="border border-line bg-panel/40 p-4 text-xs text-muted">Catalog unavailable — check backend/catalog.yaml.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {catalog.map((entry) => (
                  <div key={entry.key} className={`border bg-panel/60 ${entry.file_exists ? 'border-line' : 'border-line/60'}`}>
                    <div className="flex items-start justify-between border-b border-line p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${ROLE_COLORS[entry.capability] ?? 'border-line text-muted'}`}>
                            {ROLE_LABELS[entry.capability] ?? entry.capability}
                          </span>
                          <span className="font-mono text-[8px] text-slate-500">{entry.family}</span>
                        </div>
                        <div className="mt-1.5 text-sm font-bold text-slate-100">{entry.name}</div>
                        <div className="mt-0.5 text-[10px] text-muted">{entry.description}</div>
                      </div>
                      <Icon icon={Database} size={16} className="text-slate-600 shrink-0" />
                    </div>
                    <div className="grid grid-cols-4 gap-px border-b border-line bg-line/40 text-center">
                      {[
                        ['Params', entry.parameters],
                        ['Format', 'GGUF'],
                        ['Quant', entry.quantization],
                        ['Size', entry.size_gb ? `~${entry.size_gb} GB` : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-panel/80 px-2 py-2">
                          <div className="font-mono text-[8px] uppercase text-slate-600">{label}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-200">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-4 py-3">
                      {(entry.capabilities ?? []).slice(0, 4).map((cap) => (
                        <span key={cap} className="border border-signal/25 bg-signal/5 px-2 py-0.5 font-mono text-[8px] text-signal">✓ {cap}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-line/50 px-4 py-2.5">
                      <span className={`font-mono text-[9px] ${entry.file_exists ? 'text-signal' : 'text-warning'}`}>
                        {entry.file_exists ? '✓ Package present on node' : 'Package not yet imported'}
                      </span>
                      <button
                        onClick={() => chooseCatalogModel(entry)}
                        disabled={!entry.file_exists}
                        className="flex items-center gap-1.5 border border-signal/30 bg-signal/8 px-3 py-1.5 text-xs text-signal disabled:opacity-40 disabled:cursor-not-allowed"
                        title={entry.file_exists ? 'Start model admission' : `Import ${entry.model_path} into backend/models first`}
                      >
                        <Icon icon={PlayCircle} size={12} /> Admit Model
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {modelFiles.length > 0 && (
              <div className="border border-line bg-panel/40 p-4">
                <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-muted">Local repository — files physically present in backend/models</div>
                <div className="space-y-1.5">
                  {modelFiles.map((f) => (
                    <div key={f.path} className="flex items-center justify-between border border-line/50 bg-ink/30 px-3 py-2">
                      <span className="flex items-center gap-2 font-mono text-[10px] text-slate-200">
                        <Icon icon={HardDrive} size={11} className="text-muted" />
                        {f.path}
                      </span>
                      {f.error ? <span className="text-[9px] text-warning">{f.error}</span> : <span className="text-[9px] text-signal">inspectable ✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Deployments ───────────────────────────────────────────── */}
        {tab === 'admissions' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border border-line bg-panel/30 px-4 py-3 text-[10px] text-muted">
              <Icon icon={ShieldCheck} size={13} className="text-signal shrink-0" />
              <span>Deployment history: immutable admission records with SHA-256, deployment node, port, operator and governance outcomes.</span>
            </div>
            {admissions.length === 0 ? (
              <div className="border border-dashed border-line/60 bg-panel/20 p-6 text-center text-xs text-slate-500">No model admissions yet. Admit a model from the Sovereign Catalog to create the first record.</div>
            ) : (
              admissions.map((rec) => (
                <div key={rec.id} className="border border-line bg-panel/60">
                  <div className="flex items-start justify-between border-b border-line px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-100">{rec.model_name}</span>
                        <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${ROLE_COLORS[rec.role] ?? 'border-line text-muted'}`}>{ROLE_LABELS[rec.role] ?? rec.role}</span>
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-muted">
                        {SOURCE_LABELS[rec.source] ?? rec.source} · by {rec.admitted_by} · {rec.admitted_at ? new Date(rec.admitted_at).toLocaleString() : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[9px] text-signal">ADMITTED</div>
                      {rec.node && <div className="mt-1 font-mono text-[9px] text-muted">{rec.node}{rec.port ? ` : ${rec.port}` : ''}</div>}
                    </div>
                  </div>
                  <div className="px-4 py-2.5 font-mono text-[9px] text-slate-500">
                    SHA-256 <span className="text-slate-300">{rec.sha256}</span>
                  </div>
                  {rec.checks && rec.checks.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line/50 px-4 py-2.5 sm:grid-cols-3">
                      {rec.checks.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5">
                          <Icon icon={c.status === 'passed' ? CheckCircle2 : XCircle} size={10} className={c.status === 'passed' ? 'text-signal' : 'text-danger'} />
                          <span className="font-mono text-[9px] text-slate-400">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

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

// ---------------------------------------------------------------------------
// Admission wizard
// ---------------------------------------------------------------------------

interface WizardProps {
  state: WizardState
  catalog: CatalogModel[]
  modelFiles: ModelFileInfo[]
  onChooseSource: (source: string) => void
  onChooseCatalog: (entry: CatalogModel) => void
  onChooseLocal: (modelPath: string) => void
  onChooseRole: (role: string) => void
  onBack: () => void
  onPrecheck: () => void
  onProvision: () => void
  onDone: () => void
}

function AdmissionWizard({ state, catalog, modelFiles, onChooseSource, onChooseCatalog, onChooseLocal, onChooseRole, onBack, onPrecheck, onProvision, onDone }: WizardProps) {
  const selectedEntry = state.step === 'select' || state.step === 'precheck' || state.step === 'provision'
    ? catalog.find((c) => c.key === state.catalogKey)
    : undefined

  return (
    <div className="border border-signal/30 bg-panel/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon={ShieldCheck} size={15} className="text-signal" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">AntarAI Model Admission</span>
        </div>
        <button onClick={onBack} className="text-[10px] text-muted hover:text-slate-100">✕ Close</button>
      </div>

      {/* Step 1 — source */}
      {state.step === 'source' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300">Choose the model source. AntarAI never downloads at runtime — every source is verified and admitted locally.</div>
          {[
            { id: 'catalog', title: 'Sovereign Catalog', desc: 'Curated open-weight models pre-approved by policy', icon: Package },
            { id: 'local', title: 'Local GGUF', desc: 'A model file already present in backend/models', icon: HardDrive },
            { id: 'offline-package', title: 'Offline Model Package', desc: 'Internal repository / USB import — file in backend/models', icon: Database },
          ].map((src) => (
            <button key={src.id} onClick={() => onChooseSource(src.id)} className="flex w-full items-start gap-3 border border-line bg-ink/30 p-4 text-left hover:border-signal/40 transition-colors">
              <Icon icon={src.icon} size={16} className="mt-0.5 text-signal shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-100">{src.title}</div>
                <div className="mt-0.5 text-[10px] text-muted">{src.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — select */}
      {state.step === 'select' && (
        <div className="space-y-3">
          {state.source === 'catalog' ? (
            <>
              <div className="text-xs text-slate-300">Select a catalog model to admit.</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.map((entry) => (
                  <button key={entry.key} onClick={() => onChooseCatalog(entry)} disabled={!entry.file_exists} className={`border p-3 text-left transition-colors ${state.catalogKey === entry.key ? 'border-signal/60 bg-signal/8' : 'border-line bg-ink/30 hover:border-signal/40'} disabled:opacity-40`}>
                    <div className="text-xs font-semibold text-slate-100">{entry.name}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-400">{entry.parameters} · {entry.quantization} · ~{entry.size_gb} GB</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-wider text-muted">{ROLE_LABELS[entry.capability] ?? entry.capability}</div>
                  </button>
                ))}
              </div>
              {state.catalogKey && (
                <button onClick={onPrecheck} className="flex w-full items-center justify-center gap-2 border border-signal/30 bg-signal/10 px-4 py-2.5 text-xs font-semibold text-signal">
                  <Icon icon={PlayCircle} size={13} /> Run Admission Check
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-300">Pick the GGUF from the local repository and assign its capability slot.</div>
              <div className="space-y-1.5">
                {modelFiles.filter((f) => !f.error).map((f) => (
                  <button key={f.path} onClick={() => onChooseLocal(f.path)} className={`w-full border px-3 py-2 text-left font-mono text-[10px] transition-colors ${state.modelPath === f.path ? 'border-signal/60 bg-signal/8 text-signal' : 'border-line bg-ink/30 text-slate-200 hover:border-signal/40'}`}>
                    {f.path}
                  </button>
                ))}
                {modelFiles.filter((f) => !f.error).length === 0 && (
                  <div className="border border-dashed border-line/60 p-4 text-center text-[10px] text-warning">No .gguf files found under backend/models. Import an offline package first.</div>
                )}
              </div>
              {state.modelPath && (
                <>
                  <label className="block text-[10px] text-muted" htmlFor="admission-role">Capability slot</label>
                  <select id="admission-role" value={state.role} onChange={(event) => onChooseRole(event.target.value)} className="control-input w-full px-3 py-2 text-xs">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button onClick={onPrecheck} className="flex w-full items-center justify-center gap-2 border border-signal/30 bg-signal/10 px-4 py-2.5 text-xs font-semibold text-signal">
                    <Icon icon={PlayCircle} size={13} /> Run Admission Check
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — precheck */}
      {state.step === 'precheck' && (
        <div className="space-y-4">
          {state.prechecking ? (
            <div className="flex items-center gap-2 py-6 text-xs text-muted"><Icon icon={Loader2} size={14} className="animate-spin text-signal" /> Running admission checks…</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-100">{selectedEntry?.name ?? 'Local GGUF'}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{ROLE_LABELS[state.role] ?? state.role} capability slot</div>
                </div>
                <div className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${state.precheck.status === 'passed' ? 'border-signal/40 bg-signal/10 text-signal' : 'border-danger/40 bg-danger/10 text-danger'}`}>
                  {state.precheck.passed}/{state.precheck.total} PASSED
                </div>
              </div>

              {state.precheck.metadata && (
                <div className="grid grid-cols-2 gap-px border border-line bg-line/40 sm:grid-cols-4">
                  {[
                    ['Name', state.precheck.metadata.name], ['Architecture', state.precheck.metadata.architecture],
                    ['Quantization', state.precheck.metadata.quantization], ['Parameters', state.precheck.metadata.parameter_count],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="bg-panel/80 px-3 py-2">
                      <div className="font-mono text-[8px] uppercase text-slate-600">{String(label)}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-200">{String(value || '—')}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {state.precheck.checks.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 border border-line/50 bg-ink/30 px-3 py-2">
                    <Icon icon={c.status === 'passed' ? CheckCircle2 : XCircle} size={13} className={c.status === 'passed' ? 'text-signal' : 'text-danger'} />
                    <span className="w-44 shrink-0 text-[11px] text-slate-200">{c.label}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-slate-500">{c.detail}</span>
                  </div>
                ))}
              </div>

              <div className="border border-line/50 bg-ink/30 px-3 py-2.5">
                <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Hardware fit</div>
                <div className="mt-1 font-mono text-[10px] text-slate-300">{state.precheck.hardware.detail}</div>
              </div>

              {state.precheck.status === 'passed' ? (
                <button onClick={onProvision} className="flex w-full items-center justify-center gap-2 border border-signal bg-signal px-4 py-2.5 text-xs font-semibold text-action shadow-[0_0_16px_rgba(249,115,22,0.3)]">
                  <Icon icon={PlayCircle} size={13} /> Proceed with Installation
                </button>
              ) : (
                <div className="border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">{state.precheck.error ?? 'Admission checks failed — resolve the issues above before installing.'}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4 — provision */}
      {state.step === 'provision' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Model Provisioning</span>
            {state.running && <Icon icon={Loader2} size={14} className="animate-spin text-signal" />}
          </div>
          <div className="space-y-1.5">
            {state.events.filter((e) => e.type === 'admission.step').map((ev, i) => (
              <div key={i} className="flex items-center gap-2 border border-line/50 bg-ink/30 px-3 py-2">
                {ev.status === 'running' && <Icon icon={Loader2} size={12} className="animate-spin text-slate-400" />}
                {ev.status === 'passed' && <Icon icon={CheckCircle2} size={12} className="text-signal" />}
                {ev.status === 'failed' && <Icon icon={XCircle} size={12} className="text-danger" />}
                <span className="w-32 shrink-0 font-mono text-[9px] uppercase tracking-wider text-slate-400">{ev.step}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-slate-300">{ev.detail}</span>
              </div>
            ))}
          </div>
          {state.failed && (
            <div className="border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">Admission failed — review the failed step above.</div>
          )}
          {state.done && (
            <div className="space-y-3 border border-signal/40 bg-signal/8 p-4">
              <div className="flex items-center gap-2">
                <Icon icon={CheckCircle2} size={16} className="text-signal" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Model Ready</span>
              </div>
              {(() => {
                const finalEv = state.events.find((e) => e.type === 'admission.completed')
                return (
                  <div className="text-xs text-slate-200">
                    {finalEv?.detail ?? 'Admitted'}
                    {finalEv?.summary?.sha256 != null && (
                      <div className="mt-1 font-mono text-[9px] text-slate-500">SHA-256 {String(finalEv.summary.sha256)}</div>
                    )}
                  </div>
                )
              })()}
              <button onClick={onDone} className="flex items-center gap-1.5 border border-signal/30 bg-signal/10 px-4 py-2 text-xs text-signal">
                <Icon icon={CheckCircle2} size={12} /> View in Model Center
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
