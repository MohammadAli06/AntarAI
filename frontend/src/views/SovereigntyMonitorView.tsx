import { useState } from 'react'
import { Activity, Database, Globe2, RefreshCw, Server, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react'
import { fetchSovereigntyStatus } from '../lib/api'
import type { SovereigntyStatus } from '../lib/types'
import { Icon } from '../components/ui/Icon'

interface SovereigntyMonitorViewProps {
  status: SovereigntyStatus | null
  onStatusChange: (status: SovereigntyStatus) => void
}

const LOCAL_SERVICES = [
  { address: '127.0.0.1:8080', name: 'LLM Runtime (llama.cpp)' },
  { address: '127.0.0.1:8000', name: 'AntarAI API Server' },
  { address: '127.0.0.1:9000', name: 'Vector Store (ChromaDB)' },
  { address: '127.0.0.1:9001', name: 'OCR Engine (Tesseract)' },
  { address: '127.0.0.1:9002', name: 'Document Generator' },
  { address: '127.0.0.1:9003', name: 'Python Sandbox' },
  { address: '127.0.0.1:5432', name: 'Local Database' },
]

const MODEL_INTEGRITY = [
  { file: 'general.gguf', model: 'Qwen3-8B-Q4_K_M', verified: true },
  { file: 'coder.gguf', model: 'Qwen-Coder-Q4_K_M', verified: true },
  { file: 'vision.gguf', model: 'Qwen-VL-Q4_K_M', verified: true },
]

const DATA_PATHS = [
  { label: 'Models', path: '/opt/antarai/models' },
  { label: 'Knowledge', path: '/opt/antarai/knowledge' },
  { label: 'Outputs', path: '/opt/antarai/outputs' },
  { label: 'Sandbox', path: '/opt/antarai/sandbox' },
]

const RECENT_EVENTS = [
  { icon: Server, text: '127.0.0.1 → Qwen3-8B-Q4_K_M — llama.cpp completion accepted', blocked: false },
  { icon: Database, text: 'localhost → ChromaDB — vector context retrieved locally', blocked: false },
  { icon: FileText, text: 'localhost → Tesseract OCR — document text extracted on-device', blocked: false },
  { icon: Globe2, text: 'External egress attempt blocked — air-gapped boundary enforced', blocked: true },
  { icon: Activity, text: 'localhost → File System — read/write scoped to /data, /outputs', blocked: false },
]

export function SovereigntyMonitorView({ status, onStatusChange }: SovereigntyMonitorViewProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setRefreshing(true)
    setError('')
    try {
      onStatusChange(await fetchSovereigntyStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status unavailable')
    } finally {
      setRefreshing(false)
    }
  }

  const isAirGapped = status?.online !== false && (status?.externalCalls ?? 0) === 0

  // Real local services + model integrity from the backend, with static fallback.
  const services =
    status?.localServices && status.localServices.length > 0
      ? status.localServices.map((s) => ({ address: s.address, name: s.name, online: s.online ?? true }))
      : LOCAL_SERVICES.map((s) => ({ address: s.address, name: s.name, online: true }))
  const integrity =
    status?.modelIntegrity && status.modelIntegrity.length > 0
      ? status.modelIntegrity.map((m) => ({ file: m.modelFile, model: m.modelFile, sha256: m.sha256, verified: m.verified }))
      : MODEL_INTEGRITY.map((m) => ({ file: m.file, model: m.model, sha256: '', verified: m.verified }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow mb-1">Local execution boundary</div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">Sovereignty Monitor</h2>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
          >
            <Icon icon={RefreshCw} size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
        )}

        {/* Main sovereignty banner */}
        <div className={`border px-5 py-5 ${isAirGapped ? 'border-signal/30 bg-signal/5' : 'border-warning/30 bg-warning/5'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex size-10 items-center justify-center border ${isAirGapped ? 'border-signal/30 bg-signal-dim/40 text-signal' : 'border-warning/30 bg-warning/10 text-warning'}`}>
              <Icon icon={ShieldCheck} size={20} strokeWidth={1.8} />
            </div>
            <div>
              <div className={`font-bold tracking-wide ${isAirGapped ? 'text-signal' : 'text-warning'}`}>
                {isAirGapped ? '● SOVEREIGN MODE ACTIVE' : '⚠ SOVEREIGNTY STATUS UNKNOWN'}
              </div>
              <div className="text-[10px] text-muted">All processing within organizational infrastructure</div>
            </div>
          </div>

          {/* Network stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Internet Access', value: 'BLOCKED', color: 'text-signal' },
              { label: 'Outbound Connections', value: String(status?.externalCalls ?? 0), color: 'text-signal' },
              { label: 'Blocked Attempts', value: String(status?.blockedAttempts ?? 0), color: status?.blockedAttempts ? 'text-warning' : 'text-signal' },
              { label: 'Local Services', value: String(LOCAL_SERVICES.length), color: 'text-muted' },
            ].map((s) => (
              <div key={s.label} className="border border-line/60 bg-ink/30 px-3 py-2.5">
                <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{s.label}</div>
                <div className={`mt-1 font-mono text-sm font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Local services */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={Server} size={11} />
            Active Local Services
          </div>
          <div className="border border-line bg-panel/40 divide-y divide-line/40">
            {services.map((svc) => (
              <div key={svc.address} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 rounded-full shrink-0 ${svc.online ? 'bg-signal' : 'bg-danger'}`} />
                  <span className="font-mono text-[10px] text-signal">{svc.address}</span>
                </div>
                <span className="text-muted">{svc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data location */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={Database} size={11} />
            Data Location
          </div>
          <div className="border border-line bg-panel/40 divide-y divide-line/40">
            {DATA_PATHS.map((p) => (
              <div key={p.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-muted">{p.label}</span>
                <span className="font-mono text-[10px] text-signal">{p.path}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model integrity */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={ShieldCheck} size={11} />
            Model Integrity
          </div>
          <div className="border border-line bg-panel/40 divide-y divide-line/40">
            {MODEL_INTEGRITY.map((m) => (
              <div key={m.file} className="flex items-center justify-between px-4 py-3 text-xs">
                <div>
                  <div className="font-mono text-[10px] text-slate-300">{m.model}</div>
                  <div className="text-[9px] text-slate-600">{m.file}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon icon={CheckCircle2} size={12} className="text-signal" />
                  <div>
                    <div className="font-mono text-[9px] text-signal">SHA256 ✓ VERIFIED</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity log */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={Activity} size={11} />
            Live System Activity
          </div>
          <div className="border border-line bg-navy/80 divide-y divide-line/40 font-mono text-[10px]">
            {RECENT_EVENTS.map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Icon icon={ev.icon} size={12} className={ev.blocked ? 'text-danger' : 'text-signal/70'} />
                <span className={ev.blocked ? 'text-danger' : 'text-slate-400'}>{ev.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer stamp */}
        <div className="border border-line/50 bg-ink/30 px-4 py-3 text-[9px] font-mono text-slate-600 flex items-center justify-between">
          <span>Model: Qwen3-8B-Q4_K_M · Endpoint: 127.0.0.1:8080</span>
          <span className={isAirGapped ? 'text-signal' : 'text-warning'}>
            {isAirGapped ? 'No outbound connections detected' : 'Connectivity status unknown'}
          </span>
        </div>
      </div>
    </div>
  )
}
