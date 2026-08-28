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
  Wrench,
  Zap,
} from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { SovereigntyStatus, UserRole, ViewId, WorkflowTemplate } from '../../lib/types'
import { WORKFLOW_TEMPLATES, MOCK_APPROVAL_QUEUE } from '../../lib/mockData'

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

  return (
    <div className="space-y-6 p-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow mb-1">Operational workspace</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">
            {greeting}, Engineer <span className="text-signal">✦</span>
          </h2>
          <p className="mt-1 text-xs text-muted">What would you like the AI to do today?</p>
        </div>
        <button
          onClick={() => onNavigate('workspace')}
          className="flex items-center gap-2 border border-signal/40 bg-signal-dim/35 px-4 py-2 text-xs font-semibold text-signal transition-colors hover:bg-signal-dim"
        >
          <Icon icon={Plus} size={14} />
          New Task
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active Tasks', value: '3', icon: Activity, color: 'text-signal', bg: 'bg-signal/8 border-signal/20' },
          { label: 'Pending Approval', value: '2', icon: Clock, color: 'text-warning', bg: 'bg-warning/8 border-warning/20' },
          { label: 'Completed Today', value: '7', icon: CheckCircle2, color: 'text-signal', bg: 'bg-signal/8 border-signal/20' },
          { label: 'Deliverables', value: '14', icon: FolderOutput, color: 'text-muted', bg: 'bg-panel border-line' },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 border p-4 ${stat.bg}`}>
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
          {[
            { name: 'Approval_Note_TASK-1042.docx', type: 'DOCX', time: '14:20', status: 'approved' },
            { name: 'Pressure_Calc_CDU4.xlsx', type: 'XLSX', time: '13:51', status: 'pending_approval' },
            { name: 'Inspection_Summary_P201.xlsx', type: 'XLSX', time: '11:32', status: 'delivered' },
          ].map((file) => (
            <div key={file.name} className="flex items-center gap-3 border border-line bg-panel/40 px-4 py-3">
              <Icon icon={FileText} size={15} className="shrink-0 text-signal" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">{file.name}</span>
              <span className="font-mono text-[9px] text-muted">{file.time}</span>
              <span
                className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${
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
          <Icon icon={Sparkles} size={12} />
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
              className="group flex flex-col items-start border border-line bg-panel/50 p-4 text-left transition-all duration-200 hover:border-signal/30 hover:bg-panel"
            >
              <span className="mb-2 text-xl">{tpl.icon}</span>
              <div className="mb-1 text-xs font-semibold text-slate-200 group-hover:text-slate-100">
                {tpl.title}
              </div>
              <div className="text-[10px] leading-4 text-muted">{tpl.description}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {tpl.capabilities.slice(0, 3).map((cap) => (
                  <span key={cap} className="border border-line px-1.5 py-0.5 font-mono text-[8px] text-slate-600">
                    {cap}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex w-full items-center justify-between pt-3">
                <span
                  className={`font-mono text-[8px] uppercase px-1.5 py-0.5 border ${
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

// ── Approver Home ─────────────────────────────────────────────────────────────
function ApproverHome({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="eyebrow mb-1">Approval dashboard</div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">Review Overview</h2>
        <p className="mt-1 text-xs text-muted">AI-generated deliverables awaiting human authorization.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pending Review', value: '4', icon: Clock, color: 'text-warning', bg: 'bg-warning/8 border-warning/25' },
          { label: 'High Risk', value: '1', icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/8 border-danger/25' },
          { label: 'Approved Today', value: '12', icon: CheckCircle2, color: 'text-signal', bg: 'bg-signal/8 border-signal/25' },
          { label: 'Returned for Revision', value: '2', icon: RefreshCw, color: 'text-muted', bg: 'bg-panel border-line' },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 border p-4 ${stat.bg}`}>
            <Icon icon={stat.icon} size={18} className={stat.color} />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-100">{stat.value}</div>
              <div className="text-[10px] text-muted">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">Pending Approval Queue</div>
          <button onClick={() => onNavigate('approvals')} className="text-[10px] text-signal hover:underline">
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border border-line bg-panel/40 text-xs">
            <thead>
              <tr className="border-b border-line bg-ink/20">
                {['Task', 'Engineer', 'Risk', 'Evidence', 'Created', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {MOCK_APPROVAL_QUEUE.map((task) => (
                <tr key={task.id} className="transition-colors hover:bg-raised/20">
                  <td className="px-4 py-3 font-medium text-slate-200">{task.promptPreview}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">{task.ownerName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-1.5 py-0.5 border font-mono text-[9px] uppercase ${
                        task.risk === 'high' ? 'border-danger/30 text-danger bg-danger/8' : 'border-warning/30 text-warning bg-warning/8'
                      }`}
                    >
                      {task.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">{task.evidenceCount} refs</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {new Date(task.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="border border-signal/30 bg-signal/8 px-2.5 py-1 text-[9px] font-semibold text-signal hover:bg-signal/15 transition-colors"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Admin Home ────────────────────────────────────────────────────────────────
function AdminHome({ sovereignty }: { sovereignty: SovereigntyStatus | null }) {
  const isAirGapped = sovereignty?.online !== false && sovereignty?.externalCalls === 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="eyebrow mb-1">System control plane</div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">System Overview</h2>
      </div>

      {/* Sovereignty status banner */}
      <div
        className={`flex items-center justify-between border px-5 py-4 ${
          isAirGapped ? 'border-signal/30 bg-signal/5' : 'border-warning/30 bg-warning/5'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon icon={ShieldCheck} size={20} className={isAirGapped ? 'text-signal' : 'text-warning'} />
          <div>
            <div className={`text-sm font-bold tracking-wide ${isAirGapped ? 'text-signal' : 'text-warning'}`}>
              {isAirGapped ? 'AIR-GAP VERIFIED' : 'SOVEREIGNTY STATUS UNKNOWN'}
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              Outbound: {sovereignty?.externalCalls ?? 0} · Blocked: {sovereignty?.blockedAttempts ?? 0} · Local services: {sovereignty?.localServices?.length ?? 7}
            </div>
          </div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-mono text-[10px] text-muted">Active tasks</div>
          <div className="text-lg font-bold text-slate-100">4</div>
        </div>
      </div>

      {/* Resource gauges */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'GPU', value: 63, unit: '%', icon: Cpu, color: 'bg-signal' },
          { label: 'VRAM', value: 71, unit: '11.4 / 16 GB', icon: MemoryStick, color: 'bg-signal' },
          { label: 'CPU', value: 31, unit: '%', icon: Activity, color: 'bg-blue-500' },
          { label: 'RAM', value: 59, unit: '19 / 32 GB', icon: Activity, color: 'bg-blue-500' },
        ].map((r) => (
          <div key={r.label} className="border border-line bg-panel/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted">{r.label}</span>
              <span className="font-mono text-xs font-bold text-slate-200">{r.unit}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/60">
              <div
                className={`h-full rounded-full ${r.color} transition-all`}
                style={{ width: `${r.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Models + Tools health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={Cpu} size={11} /> Models
          </div>
          <div className="space-y-2">
            {[
              { name: 'Qwen3-8B', role: 'General', status: 'ONLINE' },
              { name: 'Qwen-Coder', role: 'Coder', status: 'ONLINE' },
              { name: 'Qwen-VL', role: 'Vision', status: 'ONLINE' },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between border border-line bg-panel/40 px-4 py-2.5">
                <div>
                  <div className="text-xs font-medium text-slate-200">{m.name}</div>
                  <div className="text-[9px] text-muted">{m.role}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span className="font-mono text-[9px] text-signal">{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={Wrench} size={11} /> Tools
          </div>
          <div className="space-y-2">
            {[
              { name: 'Python Sandbox', status: 'HEALTHY' },
              { name: 'Local OCR', status: 'HEALTHY' },
              { name: 'Vector Store (RAG)', status: 'HEALTHY' },
              { name: 'Document Generator', status: 'HEALTHY' },
            ].map((t) => (
              <div key={t.name} className="flex items-center justify-between border border-line bg-panel/40 px-4 py-2.5">
                <span className="text-xs text-slate-200">{t.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span className="font-mono text-[9px] text-signal">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="eyebrow mb-3 flex items-center gap-1.5">
          <Icon icon={Zap} size={11} /> Recent Activity
        </div>
        <div className="border border-line bg-panel/30 divide-y divide-line/40">
          {[
            { msg: 'Task TASK-1042 completed — Approval Note generated', time: '14:31', type: 'success' },
            { msg: 'Knowledge retrieval: 4 sources from SOP-PUMP-042', time: '14:29', type: 'info' },
            { msg: 'Model Qwen-VL routed for vision task', time: '14:28', type: 'info' },
            { msg: 'Task TASK-1041 submitted for approval', time: '13:52', type: 'warning' },
            { msg: 'External egress blocked — 0 outbound connections', time: '13:48', type: 'success' },
          ].map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-[10px]">
              <span
                className={`size-1.5 rounded-full shrink-0 ${
                  log.type === 'success' ? 'bg-signal' :
                  log.type === 'warning' ? 'bg-warning' : 'bg-blue-500'
                }`}
              />
              <span className="flex-1 text-slate-300">{log.msg}</span>
              <span className="font-mono text-slate-600 shrink-0">{log.time}</span>
            </div>
          ))}
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
