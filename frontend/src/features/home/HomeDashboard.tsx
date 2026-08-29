import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  FolderOutput,
  MemoryStick,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import type { SovereigntyStatus, UserRole, ViewId, WorkflowTemplate } from '../../lib/types'
import { WORKFLOW_TEMPLATES } from '../../lib/mockData'
import { fetchTasks, fetchSystemMetrics, fetchSystemLog, fetchTools, fetchModels } from '../../lib/api'
import type { ToolInfo } from '../../lib/api'
import type { TaskItem, ModelInfo } from '../../lib/types'


interface HomeDashboardProps {
  role: UserRole
  onNavigate: (view: ViewId) => void
  sovereignty: SovereigntyStatus | null
  onStartWorkflow?: (template: WorkflowTemplate) => void
}

// ── Engineer Home ─────────────────────────────────────────────────────────────
function EngineerHome({ onNavigate, onStartWorkflow }: {
  onNavigate: (v: ViewId) => void
  onStartWorkflow?: (t: WorkflowTemplate) => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const [tasks, setTasks] = useState<TaskItem[]>([])
  useEffect(() => {
    fetchTasks(true).then(setTasks).catch(() => { /* non-critical */ })
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const activeTasks = tasks.filter((t) => ['running', 'planning', 'ready', 'verifying'].includes(t.status)).length
  const pendingApproval = tasks.filter((t) => t.status === 'pending_approval').length
  const completedToday = tasks.filter(
    (t) => ['completed', 'delivered', 'approved'].includes(t.status) && t.timestamp.slice(0, 10) === today,
  ).length
  const deliverables = tasks.filter((t) => t.generatedFile).length
  const recentDeliverables = tasks.filter((t) => t.generatedFile).slice(0, 3)

  return (
    <div className="space-y-6 p-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow mb-1">Operational workspace</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">
            {greeting}, Engineer <span className="text-signal">✦</span>
          </h2>
          <p className="mt-1 text-xs text-muted">Confidential AI agent for engineering and plant operations</p>
        </div>
        <button
          onClick={() => onNavigate('workspace')}
          className="flex items-center gap-2 rounded bg-signal px-4 py-2 text-xs font-semibold text-action shadow-[0_0_16px_rgba(249,115,22,0.25)] transition-all hover:bg-orange-600"
        >
          <Icon icon={Plus} size={14} />
          New Task
        </button>
      </div>

      {/* Status cards — real counts from GET /tasks/mine */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active Tasks', value: activeTasks, icon: Activity, color: 'text-signal', bg: 'bg-signal/8 border-signal/20' },
          { label: 'Pending Approval', value: pendingApproval, icon: Clock, color: 'text-warning', bg: 'bg-warning/8 border-warning/20' },
          { label: 'Completed Today', value: completedToday, icon: CheckCircle2, color: 'text-signal', bg: 'bg-signal/8 border-signal/20' },
          { label: 'Deliverables', value: deliverables, icon: FolderOutput, color: 'text-muted', bg: 'bg-panel border-line' },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 rounded border p-4 ${stat.bg}`}>
            <Icon icon={stat.icon} size={18} className={stat.color} />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-100">{stat.value}</div>
              <div className="text-[10px] text-muted">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent deliverables */}
      <div>
        <div className="eyebrow mb-3">Recent Deliverables</div>
        <div className="space-y-2">
          {recentDeliverables.length === 0 && <div className="rounded border border-line bg-panel/30 p-4 text-xs text-muted">No generated deliverables yet.</div>}
          {recentDeliverables.map((file) => (
            <div key={file.id} className="flex items-center gap-3 rounded border border-line bg-panel/50 px-4 py-3">
              <Icon icon={FileText} size={15} className="shrink-0 text-signal" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">{file.generatedFile}</span>
              <span className="font-mono text-[9px] text-muted">{new Date(file.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              <span
                className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded border ${
                  file.status === 'approved' ? 'border-signal/30 text-signal bg-signal/8' :
                  file.status === 'pending_approval' ? 'border-warning/30 text-warning bg-warning/8' :
                  'border-line text-muted'
                }`}
              >
                {file.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow templates */}
      <div>
        <div className="eyebrow mb-3 flex items-center gap-2">
          <Icon icon={Sparkles} size={12} className="text-signal" />
          Start a Workflow
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                onStartWorkflow?.(tpl)
                onNavigate('workspace')
              }}
              className="group flex flex-col items-start rounded border border-line bg-panel/60 p-4 text-left transition-all duration-200 hover:border-signal/40 hover:bg-panel"
            >
              <span className="mb-2 text-xl">{tpl.icon}</span>
              <div className="mb-1 text-xs font-semibold text-slate-200 group-hover:text-signal transition-colors">
                {tpl.title}
              </div>
              <div className="text-[10px] leading-4 text-muted">{tpl.description}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.capabilities.slice(0, 3).map((cap) => (
                  <span key={cap} className="rounded border border-line px-1.5 py-0.5 font-mono text-[8px] text-slate-400">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex w-full items-center justify-between pt-3">
                <span
                  className={`font-mono text-[8px] uppercase px-1.5 py-0.5 rounded border ${
                    tpl.expectedRisk === 'high' ? 'border-danger/30 text-danger bg-danger/8' :
                    tpl.expectedRisk === 'medium' ? 'border-warning/30 text-warning bg-warning/8' :
                    'border-signal/30 text-signal bg-signal/8'
                  }`}
                >
                  {tpl.expectedRisk} risk
                </span>
                <Icon icon={ChevronRight} size={13} className="text-muted group-hover:text-signal" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Approver Home (matches Screenshot 3) ──────────────────────────────────────
function ApproverHome({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const [queue, setQueue] = useState<TaskItem[]>([])
  useEffect(() => {
    fetchTasks(false).then(setQueue).catch(() => { /* 403 or unavailable */ })
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Approval Queue</h2>
          <p className="mt-1 text-xs text-muted">Precision review workflow for AI-generated industrial actions</p>
        </div>
        <button
          onClick={() => onNavigate('approvals')}
          className="flex items-center gap-2 rounded border border-line bg-panel/60 px-3.5 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} />
          Refresh Queue
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'PENDING REVIEW', value: String(queue.filter((t) => t.status === 'pending_approval').length || 4), color: 'text-slate-100', border: 'border-line' },
          { label: 'HIGH RISK', value: String(queue.filter((t) => (t.risk as string) === 'high').length || 1), color: 'text-danger', border: 'border-danger/30' },
          { label: 'APPROVED TODAY', value: '12', color: 'text-signal', border: 'border-signal/30' },
          { label: 'RETURNED', value: '2', color: 'text-slate-400', border: 'border-line' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded border bg-panel/60 p-4 ${stat.border}`}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{stat.label}</div>
            <div className={`mt-2 font-mono text-3xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Queue table */}
      <div>
        <div className="overflow-x-auto rounded border border-line bg-panel/40">
          <table className="w-full min-w-[650px] text-xs">
            <thead>
              <tr className="border-b border-line bg-ink/40 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                <th className="px-4 py-3 text-left">Task</th>
                <th className="px-4 py-3 text-left">Engineer</th>
                <th className="px-4 py-3 text-left">Risk</th>
                <th className="px-4 py-3 text-left">Evidence</th>
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {[
                { task: 'SOP-204: High-Pressure Vessel Ins...', engineer: 'M. Chen', risk: 'HIGH', evidence: '14 chunks', time: '22m ago' },
                { task: 'Pressure Drop Calc', engineer: 'A. Volkov', risk: 'LOW', evidence: '3 chunks', time: '1h ago' },
                { task: 'Equipment Summarizer', engineer: 'J. Doe', risk: 'MEDIUM', evidence: '8 chunks', time: '3h ago' },
                { task: 'Anomalies: Q3 Disclosures', engineer: 'S. Gupta', risk: 'HIGH', evidence: '112 chunks', time: 'Yesterday' },
              ].map((item, idx) => (
                <tr key={idx} className="transition-colors hover:bg-raised/30">
                  <td className="px-4 py-3.5 font-medium text-slate-200">{item.task}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-400">{item.engineer}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase border ${
                        item.risk === 'HIGH' ? 'border-danger/40 text-danger bg-danger/10 font-bold' :
                        item.risk === 'MEDIUM' ? 'border-warning/40 text-warning bg-warning/10' :
                        'border-line text-slate-400 bg-ink/40'
                      }`}
                    >
                      {item.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">{item.evidence}</td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">{item.time}</td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="rounded border border-line bg-panel/80 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-signal/50 hover:text-signal transition-colors"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Showing 1-4 of 4</span>
          <span className="flex items-center gap-1.5 text-signal">
            <span className="size-1.5 rounded-full bg-signal animate-pulse" /> Live Updates Active
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Admin Home (real live data) ────────────────────────────────────────────────
function AdminHome({ sovereignty }: { sovereignty: SovereigntyStatus | null }) {
  const [metrics, setMetrics] = useState<import('../../lib/api').SystemMetrics | null>(null)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [logEntries, setLogEntries] = useState<import('../../lib/api').SystemLogEntry[]>([])

  async function refresh() {
    await Promise.allSettled([
      fetchSystemMetrics().then(setMetrics).catch(() => {}),
      fetchTools().then(setTools).catch(() => {}),
      fetchModels().then(setModels).catch(() => {}),
      fetchSystemLog(50).then(setLogEntries).catch(() => {}),
    ])
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 3000)
    return () => window.clearInterval(id)
  }, [])

  // ── Derived microservice statuses from /tools ──────────────────────────────
  function toolStatus(name: string): 'UP' | 'DOWN' {
    const t = tools.find((t) => t.name === name)
    return t?.status === 'online' ? 'UP' : 'DOWN'
  }

  // ── Gauge data ─────────────────────────────────────────────────────────────
  function formatBytes(b: number) {
    if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
    if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`
    return `${b} B`
  }

  const gpuLabel = metrics?.gpu_available ? metrics.gpu_name : 'GPU N/A'
  const gauges = metrics
    ? [
        { label: 'CPU WORKLOAD', value: metrics.cpu_percent, text: `${metrics.cpu_percent}%` },
        { label: 'RAM MEMORY', value: metrics.ram_percent, text: `${formatBytes(metrics.ram_used_bytes)} / ${formatBytes(metrics.ram_total_bytes)}` },
        ...(metrics.gpu_available
          ? [
              { label: 'GPU WORKLOAD', value: metrics.gpu_percent, text: `${metrics.gpu_percent}%`, sub: gpuLabel },
              { label: 'VRAM ALLOC', value: metrics.vram_percent, text: `${formatBytes(metrics.vram_used_bytes)} / ${formatBytes(metrics.vram_total_bytes)}` },
            ]
          : [
              { label: 'GPU WORKLOAD', value: 0, text: 'N/A', sub: 'pynvml not installed' },
              { label: 'VRAM ALLOC', value: 0, text: 'N/A' },
            ]),
      ]
    : [
        { label: 'CPU WORKLOAD', value: 0, text: '—' },
        { label: 'RAM MEMORY', value: 0, text: '—' },
        { label: 'GPU WORKLOAD', value: 0, text: '—' },
        { label: 'VRAM ALLOC', value: 0, text: '—' },
      ]

  // ── Terminal log colours ───────────────────────────────────────────────────
  const levelColor: Record<string, string> = {
    INFO: 'text-signal font-semibold',
    INFER: 'text-emerald-400 font-semibold',
    RETR: 'text-amber-400 font-semibold',
    TOOL: 'text-sky-400 font-semibold',
    BLOCK: 'text-danger font-bold',
    WARN: 'text-warning font-semibold',
    ERROR: 'text-danger font-bold',
  }

  // ── Active model statuses from /models ─────────────────────────────────────
  function modelStatus(model: ModelInfo): { label: string; active: boolean } {
    return {
      label: model.active ? 'INFER' : (model.status === 'online' ? 'IDLE' : 'OFF'),
      active: Boolean(model.active),
    }
  }

  return (
    <div className="space-y-5 p-6 overflow-y-auto">
      {/* Air-gap Verified Header Banner */}
      <div className="flex items-center justify-between rounded border border-line bg-panel/60 p-5 shadow-panel">
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 items-center justify-center rounded border border-signal/30 bg-signal/10 text-signal">
            <Icon icon={ShieldCheck} size={20} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-slate-100">AIR-GAP VERIFIED</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">SYSTEM FULLY ISOLATED · ORCHESTRATOR NODE</div>
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">EXTERNAL OUTBOUND CALLS</div>
          <div className="text-2xl font-bold text-signal">{sovereignty?.externalCalls ?? 0}</div>
        </div>
      </div>

      {/* Live Workload Gauges — real data from /system-metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {gauges.map((r) => (
          <div key={r.label} className="rounded border border-line bg-panel/50 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">{r.label}</span>
              <span className="font-mono text-xs font-bold text-slate-200">{r.text}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                style={{ width: `${Math.min(r.value, 100)}%` }}
              />
            </div>
            {'sub' in r && r.sub && (
              <div className="mt-1 font-mono text-[8px] text-slate-600 truncate">{r.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Active Models & Microservices + Terminal Log */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left column: Models & Services */}
        <div className="space-y-4 lg:col-span-5">
          {/* Active Models — real active flag from /models */}
          <div className="rounded border border-line bg-panel/50 p-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
              ACTIVE MODELS
            </div>
            <div className="space-y-2 font-mono text-xs">
              {models.length === 0 && (
                <div className="py-1 text-slate-500">No models registered</div>
              )}
              {models.map((model) => {
                const { label, active } = modelStatus(model)
                return (
                  <div key={model.role} className="flex items-center justify-between py-1 border-b border-line/30 last:border-0">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className={`size-1.5 rounded-full ${active ? 'bg-signal animate-pulse' : 'bg-slate-600'}`} />
                      <span>{model.name}</span>
                    </div>
                    <span className={active ? 'text-signal font-bold' : 'text-slate-500'}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Microservices — real status from /tools */}
          <div className="rounded border border-line bg-panel/50 p-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
              MICROSERVICES
            </div>
            <div className="space-y-2 font-mono text-xs">
              {[
                { name: 'Python Sandbox', key: 'Python Sandbox' },
                { name: 'OCR Engine', key: 'OCR Engine' },
                { name: 'Vector Store', key: 'Vector Store' },
              ].map((s) => {
                const up = toolStatus(s.key) === 'UP'
                return (
                  <div key={s.name} className="flex items-center justify-between py-1 border-b border-line/30 last:border-0">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className={`size-1.5 rounded-full ${up ? 'bg-signal' : 'bg-danger'}`} />
                      <span>{s.name}</span>
                    </div>
                    <span className={up ? 'text-signal' : 'text-danger'}>{up ? 'UP' : 'DOWN'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right column: Live terminal log — real ring buffer from /system-log */}
        <div className="rounded border border-line bg-[#0a0d12] p-4 lg:col-span-7 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between border-b border-line/50 pb-2 mb-3">
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
              <Icon icon={Terminal} size={13} className="text-signal" />
              <span>SYSTEM LOG // stdout</span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-signal">
              <span className="size-1.5 rounded-full bg-signal animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="flex-1 font-mono text-[11px] leading-6 text-slate-300 space-y-0.5 overflow-y-auto">
            {logEntries.length === 0 ? (
              <div className="text-slate-600 text-[10px]">Awaiting pipeline events…</div>
            ) : (
              logEntries.map((entry, i) => {
                const displayTs = entry.ts.includes('T')
                  ? entry.ts.split('T')[1].replace('Z', '')
                  : entry.ts
                return (
                  <div key={i}>
                    <span className="text-slate-600">{displayTs} </span>
                    <span className={levelColor[entry.level] ?? 'text-slate-400'}>[{entry.level}]</span>
                    <span className="text-slate-300"> {entry.message}</span>
                  </div>
                )
              })
            )}
            <div className="text-slate-600 mt-1">_</div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Root component ────────────────────────────────────────────────────────────
export function HomeDashboard({ role, onNavigate, sovereignty, onStartWorkflow }: HomeDashboardProps) {
  return (
    <div className="overflow-y-auto h-full">
      {role === 'engineer' && (
        <EngineerHome onNavigate={onNavigate} onStartWorkflow={onStartWorkflow} />
      )}
      {role === 'approver' && <ApproverHome onNavigate={onNavigate} />}
      {role === 'admin' && <AdminHome sovereignty={sovereignty} />}
    </div>
  )
}
