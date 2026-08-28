import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { approveTask, fetchTasks, rejectTask } from '../lib/api'
import type { RiskLevel, TaskItem } from '../lib/types'
import { Icon } from '../components/ui/Icon'
import { MOCK_APPROVAL_QUEUE, MOCK_ARTIFACTS, MOCK_SOURCES, MOCK_VERIFICATION } from '../lib/mockData'

type ApproverView = 'queue' | 'review'

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'border-signal/30 bg-signal/8 text-signal',
  medium: 'border-warning/30 bg-warning/8 text-warning',
  high: 'border-danger/30 bg-danger/8 text-danger',
  critical: 'border-danger bg-danger/20 text-danger font-bold',
}

// ── Approval Queue ─────────────────────────────────────────────────────────────
function ApprovalQueue({
  tasks,
  loading,
  error,
  onRefresh,
  onReview,
}: {
  tasks: TaskItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onReview: (task: TaskItem) => void
}) {
  const pending = tasks.filter((t) => t.status === 'pending_approval')
  const history = tasks.filter((t) => t.status !== 'pending_approval')

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow mb-1">Supervisor review</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Approval Queue</h2>
          <p className="mt-1 text-xs text-muted">AI-generated deliverables requiring human authorization</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pending Review', value: pending.length, icon: Clock, style: 'border-warning/25 bg-warning/5 text-warning' },
          { label: 'High Risk', value: pending.filter((t) => t.risk === 'high' || t.risk === 'critical').length, icon: AlertTriangle, style: 'border-danger/25 bg-danger/5 text-danger' },
          { label: 'Approved Today', value: 12, icon: CheckCircle2, style: 'border-signal/25 bg-signal/5 text-signal' },
          { label: 'Returned', value: 2, icon: RefreshCw, style: 'border-line bg-panel text-muted' },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-3 border p-4 ${s.style}`}>
            <Icon icon={s.icon} size={16} />
            <div>
              <div className="text-xl font-bold text-slate-100">{s.value}</div>
              <div className="text-[9px]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* Pending queue */}
      <div>
        <div className="eyebrow mb-3 flex items-center gap-1.5">
          <Icon icon={Clock} size={11} />
          Pending Approval ({pending.length})
        </div>

        {loading ? (
          <div className="border border-line bg-panel/30 p-8 text-center text-xs text-slate-500">
            Loading queue…
          </div>
        ) : pending.length === 0 ? (
          <div className="border border-line/60 bg-panel/20 p-8 text-center text-xs text-slate-500">
            ✅ All deliverables reviewed. Queue is empty.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border border-line bg-panel/40 text-xs">
              <thead>
                <tr className="border-b border-line bg-ink/20">
                  {['Task', 'Engineer', 'Risk', 'Evidence', 'Created', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {pending.map((task) => (
                  <tr key={task.id} className="transition-colors hover:bg-raised/20">
                    <td className="px-4 py-3 font-medium text-slate-200 max-w-[200px] truncate">
                      {task.promptPreview}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted">{task.ownerName ?? `user#${task.userId}`}</td>
                    <td className="px-4 py-3">
                      <span className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${RISK_STYLE[(task.risk ?? 'medium') as RiskLevel]}`}>
                        {task.risk ?? 'MEDIUM'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted">{task.evidenceCount ?? '—'} refs</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted">
                      {new Date(task.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onReview(task)}
                        className="border border-signal/30 bg-signal/8 px-3 py-1.5 text-[9px] font-semibold text-signal hover:bg-signal/15 transition-colors"
                      >
                        Review →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit history */}
      {history.length > 0 && (
        <div>
          <div className="eyebrow mb-3">Reviewed Audit Log ({history.length})</div>
          <div className="divide-y divide-line/40 border border-line bg-panel/30">
            {history.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[9px] uppercase ${
                      t.status === 'approved' ? 'border-signal/30 bg-signal/8 text-signal' : 'border-danger/30 bg-danger/8 text-danger'
                    }`}
                  >
                    {t.status}
                  </span>
                  <span className="text-slate-300 font-medium">{t.promptPreview}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(t.timestamp).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Review Workspace ───────────────────────────────────────────────────────────
function ReviewWorkspace({
  task,
  onBack,
  onApprove,
  onReject,
  actionId,
}: {
  task: TaskItem
  onBack: () => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
  actionId: number | null
}) {
  const [comment, setComment] = useState('')
  const [approved, setApproved] = useState(false)

  function handleApprove() {
    onApprove(task.id)
    setApproved(true)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Review header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-ink/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[10px] text-muted hover:text-slate-200 transition-colors"
          >
            <Icon icon={ChevronLeft} size={14} />
            Queue
          </button>
          <span className="text-slate-700">/</span>
          <span className="font-mono text-[10px] text-slate-300">TASK-{task.id}</span>
          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${RISK_STYLE[(task.risk ?? 'medium') as RiskLevel]}`}
          >
            {(task.risk ?? 'medium').toUpperCase()} RISK
          </span>
        </div>
        <span className="font-mono text-[9px] text-muted">{task.ownerName ?? `user#${task.userId}`}</span>
      </div>

      {/* Approved banner */}
      {approved && (
        <div className="flex shrink-0 items-center justify-between border-b border-signal/30 bg-signal/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <Icon icon={CheckCircle2} size={18} className="text-signal" />
            <div>
              <div className="text-sm font-bold text-signal">APPROVED</div>
              <div className="font-mono text-[9px] text-muted">
                approver1 · {new Date().toLocaleString('en-IN')} · Task TASK-{task.id}
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-mono text-[8px] text-muted">Artifact SHA256</div>
            <div className="font-mono text-[9px] text-signal">7134FA91…84CD</div>
          </div>
        </div>
      )}

      {/* 2-column split */}
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        {/* Left: Original document */}
        <div className="flex flex-col overflow-y-auto border-r border-line bg-navy/40 p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={FileText} size={11} />
            Original Document
          </div>

          {/* PDF viewer placeholder */}
          <div className="flex-1 border border-line bg-ink/30 flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-[10px] text-muted">{task.generatedFile ?? 'inspection-report.pdf'}</span>
              <div className="flex items-center gap-2">
                <button className="text-[9px] text-muted hover:text-signal transition-colors">
                  <Icon icon={Download} size={11} />
                </button>
              </div>
            </div>
            {/* Mock PDF preview */}
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              <div className="text-[10px] font-mono text-slate-600 mb-4">Page 1 of 14</div>
              {[
                'INSPECTION REPORT — PUMP P-201',
                'Date: 28 August 2026 | Unit: Crude Distillation Unit | Engineer: Ali K.',
                '',
                '1. EXECUTIVE SUMMARY',
                'Pump P-201 (centrifugal, 450 kW rated) was inspected following reported vibration exceedance alert at 14:02 IST. Vibration reading at rated speed: 5.2 mm/s RMS.',
                '',
                '2. FINDINGS',
                '2.1 Vibration: 5.2 mm/s RMS measured. SOP limit: 4.5 mm/s RMS. Exceedance: +15.6%',
                '2.2 Bearing temperature: 82°C at 30-min mark. Baseline: 63°C. Deviation: +19°C',
                '2.3 Seal inspection: No visible leakage. Seal face in acceptable condition.',
              ].map((line, i) => (
                <div
                  key={i}
                  className={`text-[10px] ${line === '' ? 'h-3' : line.match(/^\d\./) ? 'font-semibold text-slate-300' : 'text-slate-400'} leading-4`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Deliverable */}
        <div className="flex flex-col overflow-y-auto p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={ShieldCheck} size={11} className="text-signal" />
            AI Deliverable
          </div>

          <div className="flex-1 border border-line bg-panel/60">
            <div className="border-b border-line px-4 py-2.5">
              <div className="font-mono text-[10px] text-muted">Approval_Note_TASK-{task.id}.docx</div>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto text-[10px] leading-5">
              <div className="text-sm font-bold text-slate-100">APPROVAL NOTE</div>
              <div className="font-semibold text-slate-200">Executive Summary</div>
              <p className="text-muted">
                Pump P-201 (CDU-04) was inspected on 28 August 2026 following a vibration exceedance alert. Analysis confirms vibration at 5.2 mm/s RMS exceeds the MRPL-PUMP-SOP-042 limit of 4.5 mm/s. Immediate corrective action is recommended.
              </p>
              <div className="font-semibold text-slate-200">Findings</div>
              <ul className="space-y-1 text-muted list-disc pl-4">
                <li>Vibration: 5.2 mm/s RMS (+15.6% above limit)</li>
                <li>Bearing temperature: +19°C above baseline</li>
                <li>Seal condition: Acceptable — no leakage</li>
              </ul>
              <div className="font-semibold text-slate-200">Recommendations</div>
              <ul className="space-y-1 text-muted list-disc pl-4">
                <li>Schedule bearing replacement within 72 hours</li>
                <li>Reduce pump speed to 80% rated until repair</li>
                <li>Re-inspect within 24 hours of repair completion</li>
              </ul>
              <div className="font-semibold text-slate-200">References</div>
              {MOCK_SOURCES.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[9px]">
                  <span className="text-signal">[{i + 1}]</span>
                  <span className="text-muted">{s.title} · p.{s.page}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification strip */}
          <div className="mt-3 border border-line bg-panel/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[9px]">
              {MOCK_VERIFICATION.checks.slice(0, 3).map((c, i) => (
                <div key={i} className="flex items-center gap-1 text-signal">
                  <Icon icon={CheckCircle2} size={10} />
                  {c.label}
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-muted">Confidence</span>
                <span className="font-bold text-signal">{Math.round(MOCK_VERIFICATION.confidence * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Review comment */}
          {!approved && (
            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-mono uppercase tracking-wider text-muted">
                Reviewer Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a comment or note for the record…"
                className="control-input w-full resize-none px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onReject(task.id)}
                  disabled={actionId === task.id}
                  className="flex items-center gap-1.5 border border-warning/40 bg-warning/10 px-3 py-2 text-[10px] font-semibold text-warning hover:bg-warning/15 transition-colors disabled:opacity-50"
                >
                  <Icon icon={RefreshCw} size={12} />
                  Return for Revision
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionId === task.id}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-signal/40 bg-signal-dim/35 px-3 py-2 text-[10px] font-semibold text-signal hover:bg-signal-dim transition-colors disabled:opacity-50"
                >
                  <Icon icon={CheckCircle2} size={12} />
                  ✓ Approve & Sign
                </button>
              </div>
            </div>
          )}

          {/* Approval record */}
          {approved && (
            <div className="mt-3 space-y-2 border border-signal/25 bg-signal/5 p-4 font-mono text-[9px]">
              <div className="font-mono text-[8px] uppercase tracking-wider text-muted mb-2">Approval Record</div>
              {[
                ['Approved By', 'approver1'],
                ['Timestamp', new Date().toLocaleString('en-IN')],
                ['Task', `TASK-${task.id}`],
                ['Artifact Hash', 'SHA256: 7134FA91…84CD'],
                ['Model Run', 'RUN-82041'],
                ['Evidence Set', 'EV-1092'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-signal">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Root ApprovalsView ─────────────────────────────────────────────────────────
export function ApprovalsView() {
  const [view, setView] = useState<ApproverView>('queue')
  const [tasks, setTasks] = useState<TaskItem[]>([...MOCK_APPROVAL_QUEUE])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasks(false)
      // Merge with mock queue (mock always shown for demo)
      const realIds = new Set(data.map((t) => t.id))
      const merged = [...data, ...MOCK_APPROVAL_QUEUE.filter((t) => !realIds.has(t.id))]
      setTasks(merged)
    } catch {
      // Backend unavailable — keep mock data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTasks() }, [])

  async function handleApprove(id: number) {
    setActionId(id)
    try {
      await approveTask(id)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)))
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)))
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: number) {
    setActionId(id)
    try {
      await rejectTask(id)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'rejected' as const } : t)))
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'rejected' as const } : t)))
    } finally {
      setActionId(null)
      setView('queue')
    }
  }

  if (view === 'review' && selectedTask) {
    return (
      <ReviewWorkspace
        task={selectedTask}
        onBack={() => setView('queue')}
        onApprove={handleApprove}
        onReject={handleReject}
        actionId={actionId}
      />
    )
  }

  return (
    <ApprovalQueue
      tasks={tasks}
      loading={loading}
      error={error}
      onRefresh={loadTasks}
      onReview={(task) => { setSelectedTask(task); setView('review') }}
    />
  )
}
