/**
 * AuditTrailView — Shared audit log table.
 *
 * Backed by GET /audit — accessible to approver + admin.
 * Used by:
 *   - Admin    "Audit Logs"
 *   - Approver "Audit History"
 * Identical data, one component, zero duplication.
 */
import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Download,
  RefreshCw,
  ScrollText,
  XCircle,
} from 'lucide-react'
import { fetchAudit } from '../lib/api'
import type { AuditEntry } from '../lib/api'
import { Icon } from '../components/ui/Icon'

const STATUS_STYLE: Record<string, string> = {
  approved: 'border-signal/30 bg-signal/8 text-signal',
  completed: 'border-signal/20 bg-signal/5 text-signal',
  pending_approval: 'border-warning/30 bg-warning/8 text-warning',
  rejected: 'border-danger/30 bg-danger/8 text-danger',
  failed: 'border-danger/50 bg-danger/15 text-danger',
  running: 'border-line bg-panel text-slate-400',
}

const RISK_STYLE: Record<string, string> = {
  low: 'text-signal',
  medium: 'text-warning',
  high: 'text-danger font-bold',
  critical: 'text-danger font-bold',
}

interface AuditTrailViewProps {
  title?: string
  description?: string
}

export function AuditTrailView({ title = 'Audit Trail', description = 'Immutable log of all AI task transitions and approvals' }: AuditTrailViewProps) {
  const [events, setEvents] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAudit()
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load audit trail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const approvedCount = events.filter((e) => e.status === 'approved').length
  const rejectedCount = events.filter((e) => e.status === 'rejected').length
  const pendingCount = events.filter((e) => e.status === 'pending_approval').length

  function exportCsv() {
    const headers = ['Task ID', 'Owner', 'Model', 'Status', 'Risk', 'Evidence', 'Approved By', 'Approved At', 'Timestamp', 'File']
    const rows = events.map((e) => [
      e.taskId, e.owner, e.modelUsed, e.status, e.risk ?? '', e.evidenceCount ?? '',
      e.approvedBy ?? '', e.approvedAt ?? '', e.timestamp, e.generatedFile ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-1.5">
            <Icon icon={ScrollText} size={11} />
            Governance
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h2>
          <p className="mt-1 text-xs text-muted">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/20 hover:text-signal transition-colors"
          >
            <Icon icon={Download} size={12} />
            Export CSV
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
          >
            <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Approved', value: approvedCount, icon: CheckCircle2, color: 'text-signal' },
          { label: 'Rejected', value: rejectedCount, icon: XCircle, color: 'text-danger' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-warning' },
          { label: 'Total Events', value: events.length, icon: ScrollText, color: 'text-muted' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded border border-line bg-panel/60 px-3 py-2 text-xs"
          >
            <Icon icon={s.icon} size={12} className={s.color} />
            <span className="font-bold text-slate-200">{s.value}</span>
            <span className="text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="border border-line bg-panel/30 p-12 text-center text-xs text-slate-500">
          Loading audit trail…
        </div>
      ) : events.length === 0 ? (
        <div className="border border-line/60 bg-panel/20 p-12 text-center text-xs text-slate-500">
          No audit events found. Tasks will appear here once they are submitted.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border border-line bg-panel/40 text-xs">
            <thead>
              <tr className="border-b border-line bg-ink/20">
                {['Task ID', 'Owner', 'Model', 'Status', 'Risk', 'Evidence', 'Approved By', 'Timestamp', 'File'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {events.map((ev) => (
                <tr key={ev.id} className="transition-colors hover:bg-raised/20">
                  <td className="px-4 py-3 font-mono text-[10px] text-signal">{ev.taskId}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">{ev.owner}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-400 max-w-[120px] truncate">{ev.modelUsed}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_STYLE[ev.status] ?? 'border-line bg-panel text-muted'}`}
                    >
                      {ev.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px]">
                    {ev.risk ? (
                      <span className={RISK_STYLE[ev.risk] ?? 'text-muted'}>{ev.risk.toUpperCase()}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {ev.evidenceCount != null ? `${ev.evidenceCount}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted">
                    {ev.approvedBy ?? '—'}
                    {ev.approvedAt && (
                      <div className="text-[9px] text-slate-600">
                        {new Date(ev.approvedAt).toLocaleDateString('en-IN')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                    {ev.timestamp
                      ? new Date(ev.timestamp).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted max-w-[100px] truncate">
                    {ev.generatedFile ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 font-mono text-[10px] text-slate-600">
            {events.length} event{events.length !== 1 ? 's' : ''} · all on-premise, no external calls
          </div>
        </div>
      )}
    </div>
  )
}
