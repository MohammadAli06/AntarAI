import { CheckCircle2, FileText, XCircle, Clock, ShieldCheck, RefreshCw, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { approveTask, fetchTasks, rejectTask, resolveUrl } from '../lib/api'
import type { TaskItem } from '../lib/types'
import { Icon } from '../components/ui/Icon'

export function ApprovalsView() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasks(false)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task approvals.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  async function handleApprove(id: number) {
    setActionId(id)
    try {
      await approveTask(id)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'approved' } : t)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve task')
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: number) {
    setActionId(id)
    try {
      await rejectTask(id)
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'rejected' } : t)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject task')
    } finally {
      setActionId(null)
    }
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pending_approval')
  const historyTasks = tasks.filter((t) => t.status !== 'pending_approval')

  return (
    <div className="space-y-6">
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-panel/50 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded border border-signal/40 bg-signal-dim/30 text-signal">
              <Icon icon={ShieldCheck} size={15} />
            </span>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">Human-in-the-Loop Approvals</h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Supervisor review queue for AI-generated industrial documents & notes before finalization.
          </p>
        </div>
        <button
          onClick={loadTasks}
          className="flex items-center gap-2 rounded border border-line bg-ink/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/50 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── Pending Review Queue ────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-signal">
          <Icon icon={Clock} size={14} /> Pending Approval ({pendingTasks.length})
        </h3>

        {loading ? (
          <div className="rounded-xl border border-line bg-panel/30 p-8 text-center text-xs text-slate-500">
            Loading approval queue…
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="rounded-xl border border-line/60 bg-panel/20 p-8 text-center text-xs text-slate-500">
            ✅ All AI-generated drafts have been reviewed. Queue is empty.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-panel/70 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                      Pending Review
                    </span>
                    <span className="font-mono text-xs text-slate-400">User #{task.userId}</span>
                    <span className="text-xs text-slate-500">• {new Date(task.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200">"{task.promptPreview}"</p>
                  {task.generatedFile && (
                    <div className="flex items-center gap-2 text-xs text-signal">
                      <Icon icon={FileText} size={13} />
                      <span>Draft output: {task.generatedFile}</span>
                      <a
                        href={resolveUrl(`/outputs/${encodeURIComponent(task.generatedFile)}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline text-slate-400 hover:text-signal"
                      >
                        <Icon icon={Download} size={11} /> Download
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={actionId === task.id}
                    onClick={() => handleApprove(task.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Icon icon={CheckCircle2} size={14} /> Approve
                  </button>
                  <button
                    disabled={actionId === task.id}
                    onClick={() => handleReject(task.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Icon icon={XCircle} size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reviewed Audit History ───────────────────────────────────────── */}
      <div className="space-y-3 pt-4">
        <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Reviewed Audit Log ({historyTasks.length})</h3>
        <div className="divide-y divide-line/40 rounded-xl border border-line bg-panel/30">
          {historyTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No reviewed task history yet.</div>
          ) : (
            historyTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase font-semibold ${
                      t.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {t.status}
                  </span>
                  <span className="text-slate-300 font-medium">{t.promptPreview}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">{new Date(t.timestamp).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
