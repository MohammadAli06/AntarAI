/**
 * TaskListView — Shared, filterable task table.
 *
 * Used by:
 *   - Engineer  "My Tasks"        (scope=mine, all statuses)
 *   - Approver  "All Reviews"     (scope=all,  all statuses)
 *   - Approver  "Approved Outputs" (scope=all, defaultStatus=approved)
 */
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  SquareArrowOutUpRight,
} from 'lucide-react'
import { fetchTasks } from '../lib/api'
import type { RiskLevel, TaskItem, ViewId } from '../lib/types'
import { Icon } from '../components/ui/Icon'

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'border-signal/30 bg-signal/8 text-signal',
  medium: 'border-warning/30 bg-warning/8 text-warning',
  high: 'border-danger/30 bg-danger/8 text-danger',
  critical: 'border-danger bg-danger/20 text-danger font-bold',
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'border-signal/30 bg-signal/8 text-signal',
  approved: 'border-signal/40 bg-signal/12 text-signal font-semibold',
  pending_approval: 'border-warning/30 bg-warning/8 text-warning',
  rejected: 'border-danger/30 bg-danger/8 text-danger',
  running: 'border-line bg-panel text-slate-400',
  failed: 'border-danger/50 bg-danger/15 text-danger',
}

const ALL_STATUSES = ['all', 'pending_approval', 'approved', 'rejected', 'completed', 'failed', 'running']

interface TaskListViewProps {
  scope: 'mine' | 'all'
  defaultStatus?: string
  title?: string
  description?: string
  onNavigate?: (view: ViewId) => void
}

export function TaskListView({
  scope,
  defaultStatus = 'all',
  title,
  description,
  onNavigate,
}: TaskListViewProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(defaultStatus)

  const resolvedTitle = title ?? (scope === 'mine' ? 'My Tasks' : 'All Tasks')
  const resolvedDescription =
    description ??
    (scope === 'mine'
      ? 'Tasks submitted by you — all statuses'
      : 'All tasks across all engineers')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasks(scope === 'mine')
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [scope])

  const filtered =
    statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter)

  const pending = tasks.filter((t) => t.status === 'pending_approval').length
  const approved = tasks.filter((t) => t.status === 'approved').length
  const failed = tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">{scope === 'mine' ? 'My workspace' : 'Supervisor view'}</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">{resolvedTitle}</h2>
          <p className="mt-1 text-xs text-muted">{resolvedDescription}</p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Quick stat chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Pending Approval', value: pending, icon: Clock, color: 'text-warning' },
          { label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-signal' },
          { label: 'Failed', value: failed, icon: AlertTriangle, color: 'text-danger' },
          { label: 'Total', value: tasks.length, icon: Filter, color: 'text-muted' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded border border-line bg-panel/60 px-3 py-2 text-xs"
          >
            <Icon icon={s.icon} size={13} className={s.color} />
            <span className="font-bold text-slate-200">{s.value}</span>
            <span className="text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Icon icon={Filter} size={12} className="text-muted" />
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">Filter:</span>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-2.5 py-0.5 font-mono text-[9px] uppercase transition-colors ${
                statusFilter === s
                  ? 'border-signal/40 bg-signal/12 text-signal'
                  : 'border-line bg-panel/40 text-muted hover:border-signal/20 hover:text-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="border border-line bg-panel/30 p-12 text-center text-xs text-slate-500">
          Loading tasks…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-line/60 bg-panel/20 p-12 text-center text-xs text-slate-500">
          No tasks found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border border-line bg-panel/40 text-xs">
            <thead>
              <tr className="border-b border-line bg-ink/20">
                {['Task ID', 'Prompt', scope === 'all' ? 'Engineer' : 'Model', 'Risk', 'Status', 'Evidence', 'Timestamp', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-muted"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {filtered.map((task) => (
                <tr key={task.id} className="transition-colors hover:bg-raised/20">
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                    TASK-{task.id}
                  </td>
                  <td className="px-4 py-3 max-w-[220px] truncate font-medium text-slate-200">
                    {task.promptPreview}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {scope === 'all'
                      ? (task.ownerName ?? `user#${task.userId}`)
                      : (task.modelUsed || '—')}
                  </td>
                  <td className="px-4 py-3">
                    {task.risk ? (
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${RISK_STYLE[task.risk as RiskLevel]}`}
                      >
                        {task.risk}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_STYLE[task.status] ?? 'border-line bg-panel text-muted'}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {task.evidenceCount != null ? `${task.evidenceCount} refs` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {new Date(task.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {task.status === 'pending_approval' && onNavigate && (
                      <button
                        onClick={() => onNavigate('approvals')}
                        className="flex items-center gap-1 border border-signal/30 bg-signal/8 px-2.5 py-1 text-[9px] font-semibold text-signal hover:bg-signal/15 transition-colors"
                      >
                        <Icon icon={SquareArrowOutUpRight} size={10} />
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 font-mono text-[10px] text-slate-600">
            Showing {filtered.length} of {tasks.length} tasks
          </div>
        </div>
      )}
    </div>
  )
}
