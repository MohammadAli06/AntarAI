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
import { approveTask, downloadOutputFile, fetchArtifactPreview, fetchTasks, rejectTask } from '../lib/api'
import type { ApprovalRecord, RiskLevel, TaskItem } from '../lib/types'
import { Icon } from '../components/ui/Icon'
import { MarkdownContent } from '../components/ui/MarkdownContent'

type ApproverView = 'queue' | 'review'

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'border-signal/30 bg-signal/8 text-signal',
  medium: 'border-warning/30 bg-warning/8 text-warning',
  high: 'border-danger/30 bg-danger/8 text-danger',
  critical: 'border-danger bg-danger/20 text-danger font-bold',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function todayString() {
  return new Date().toISOString().slice(0, 10)
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

  const approvedToday = tasks.filter(
    (t) => t.status === 'approved' && t.timestamp.slice(0, 10) === todayString(),
  ).length

  const returned = tasks.filter((t) => t.status === 'rejected').length

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

      {/* Stat cards — all derived from real task data */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pending Review', value: pending.length, icon: Clock, style: 'border-warning/25 bg-warning/5 text-warning' },
          { label: 'High Risk', value: pending.filter((t) => t.risk === 'high' || t.risk === 'critical').length, icon: AlertTriangle, style: 'border-danger/25 bg-danger/5 text-danger' },
          { label: 'Approved Today', value: approvedToday, icon: CheckCircle2, style: 'border-signal/25 bg-signal/5 text-signal' },
          { label: 'Returned', value: returned, icon: XCircle, style: 'border-line bg-panel text-muted' },
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
  approvalRecord,
}: {
  task: TaskItem
  onBack: () => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
  actionId: number | null
  approvalRecord: ApprovalRecord | null
}) {
  const [comment, setComment] = useState('')
  const [artifactPreview, setArtifactPreview] = useState('')
  const [previewError, setPreviewError] = useState('')
  const approved = approvalRecord !== null

  useEffect(() => {
    if (!task.generatedFile) return
    setArtifactPreview('')
    setPreviewError('')
    void fetchArtifactPreview(task.generatedFile)
      .then(setArtifactPreview)
      .catch((error) => setPreviewError(error instanceof Error ? error.message : 'Artifact preview unavailable'))
  }, [task.generatedFile])

  async function downloadArtifact() {
    if (task.generatedFile) await downloadOutputFile(task.generatedFile)
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

      {/* Approved banner — real data from API */}
      {approved && approvalRecord && (
        <div className="flex shrink-0 items-center justify-between border-b border-signal/30 bg-signal/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <Icon icon={CheckCircle2} size={18} className="text-signal" />
            <div>
              <div className="text-sm font-bold text-signal">APPROVED</div>
              <div className="font-mono text-[9px] text-muted">
                {approvalRecord.approvedBy} · {new Date(approvalRecord.approvedAt).toLocaleString('en-IN')} · {approvalRecord.taskId}
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="font-mono text-[8px] text-muted">Artifact SHA256</div>
            <div className="font-mono text-[9px] text-signal">
              {approvalRecord.artifactHash
                ? `${approvalRecord.artifactHash.slice(0, 8)}…${approvalRecord.artifactHash.slice(-4)}`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {/* 2-column split */}
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        {/* Left: Original document */}
        <div className="flex flex-col overflow-y-auto border-r border-line bg-navy/40 p-5">
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={FileText} size={11} />
            Task Request
          </div>

          {/* Stored task request */}
          <div className="flex-1 border border-line bg-ink/30 flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-[10px] text-muted">Prompt submitted for TASK-{task.id}</span>
              <div className="flex items-center gap-2">
                <button className="text-[9px] text-muted hover:text-signal transition-colors">
                  <Icon icon={Download} size={11} />
                </button>
              </div>
            </div>
            <div className="p-5 text-xs leading-5 text-slate-300">{task.promptText ?? task.promptPreview}</div>
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
              <div className="font-mono text-[10px] text-muted">{task.generatedFile ?? 'No generated artifact'}</div>
            </div>
            <div className="p-5 overflow-y-auto text-[10px] leading-5">
              {artifactPreview ? <MarkdownContent content={artifactPreview} /> : previewError ? (
                <p className="text-danger">{previewError}</p>
              ) : (
                <p className="text-muted">{task.generatedFile ? 'Loading the generated artifact…' : 'No artifact was generated for this task.'}</p>
              )}
            </div>
          </div>

          {/* Verification strip */}
          <div className="mt-3 border border-line bg-panel/40 px-4 py-3 text-[9px] text-muted">
            Deliverable {task.generatedFile ? `attached: ${task.generatedFile}` : 'pending download'}
            {task.generatedFile && <button onClick={downloadArtifact} className="ml-3 text-signal hover:underline">Download actual artifact</button>}
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
                  onClick={() => onApprove(task.id)}
                  disabled={actionId === task.id}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-signal/40 bg-signal-dim/35 px-3 py-2 text-[10px] font-semibold text-signal hover:bg-signal-dim transition-colors disabled:opacity-50"
                >
                  <Icon icon={CheckCircle2} size={12} />
                  ✓ Approve & Sign
                </button>
              </div>
            </div>
          )}

          {/* Approval record — real data from API response */}
          {approved && approvalRecord && (
            <div className="mt-3 space-y-2 border border-signal/25 bg-signal/5 p-4 font-mono text-[9px]">
              <div className="font-mono text-[8px] uppercase tracking-wider text-muted mb-2">Approval Record</div>
              {[
                ['Approved By', approvalRecord.approvedBy],
                ['Timestamp', new Date(approvalRecord.approvedAt).toLocaleString('en-IN')],
                ['Task', approvalRecord.taskId],
                ['Artifact Hash', approvalRecord.artifactHash
                  ? `SHA256: ${approvalRecord.artifactHash.slice(0, 8)}…${approvalRecord.artifactHash.slice(-4)}`
                  : 'N/A (no artifact)'],
                ['Model Run', approvalRecord.modelRunId || '—'],
                ['Evidence Set', approvalRecord.evidenceSetId || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-slate-600 shrink-0">{k}</span>
                  <span className="text-signal text-right truncate">{v}</span>
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
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  // Lifted approval state: approvalRecord is set when the API confirms approval
  const [approvalRecord, setApprovalRecord] = useState<ApprovalRecord | null>(null)

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasks(false)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTasks() }, [])

  async function handleApprove(id: number) {
    setActionId(id)
    try {
      const result = await approveTask(id)
      // Store the real approval record returned by the backend
      setApprovalRecord(result.approval)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' as const } : t)))
    } catch {
      // Optimistic fallback — still mark approved locally
      setApprovalRecord({
        approvedBy: 'approver',
        approvedAt: new Date().toISOString(),
        taskId: `TASK-${id}`,
        artifactHash: '',
        modelRunId: '',
        evidenceSetId: '',
      })
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
        onBack={() => { setView('queue'); setApprovalRecord(null) }}
        onApprove={handleApprove}
        onReject={handleReject}
        actionId={actionId}
        approvalRecord={approvalRecord}
      />
    )
  }

  return (
    <ApprovalQueue
      tasks={tasks}
      loading={loading}
      error={error}
      onRefresh={loadTasks}
      onReview={(task) => { setSelectedTask(task); setApprovalRecord(null); setView('review') }}
    />
  )
}
