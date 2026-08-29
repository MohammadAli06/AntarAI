/**
 * AlertsView — Admin alerts derived from existing data sources.
 *
 * No new backend surface needed. Derives alerts from:
 *   1. Failed tasks        → GET /tasks (status=failed)
 *   2. Blocked egress      → GET /sovereignty-status → blockedAttempts
 *
 * Used by Admin "Alerts" nav item.
 */
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  RefreshCw,
  Shield,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { fetchTasks, fetchSovereigntyStatus } from '../lib/api'
import type { TaskItem } from '../lib/types'
import { Icon } from '../components/ui/Icon'

type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

interface Alert {
  id: string
  severity: AlertSeverity
  source: 'task-failure' | 'egress-block' | 'verification'
  title: string
  detail: string
  timestamp: string
}

const SEVERITY_STYLE: Record<AlertSeverity, string> = {
  critical: 'border-danger bg-danger/15 text-danger',
  high: 'border-danger/60 bg-danger/10 text-danger',
  medium: 'border-warning/50 bg-warning/8 text-warning',
  low: 'border-line bg-panel text-muted',
}

const SEVERITY_ICON: Record<AlertSeverity, typeof AlertTriangle> = {
  critical: XCircle,
  high: AlertTriangle,
  medium: Bell,
  low: Bell,
}

function buildAlerts(tasks: TaskItem[], blockedAttempts: number, lastUpdated: string): Alert[] {
  const alerts: Alert[] = []

  // 1. Failed tasks
  const failed = tasks.filter((t) => t.status === 'failed')
  for (const t of failed) {
    alerts.push({
      id: `task-fail-${t.id}`,
      severity: (t.risk === 'high' || t.risk === 'critical') ? 'high' : 'medium',
      source: 'task-failure',
      title: `Task TASK-${t.id} failed`,
      detail: t.promptPreview
        ? `Prompt: "${t.promptPreview.slice(0, 80)}${t.promptPreview.length > 80 ? '…' : ''}"`
        : 'Task processing failed — check execution trace.',
      timestamp: t.timestamp,
    })
  }

  // 2. Blocked egress attempts
  if (blockedAttempts > 0) {
    alerts.push({
      id: 'egress-blocked',
      severity: 'critical',
      source: 'egress-block',
      title: `${blockedAttempts} outbound network attempt${blockedAttempts > 1 ? 's' : ''} blocked`,
      detail: `The sandbox or a model component attempted external connections. All ${blockedAttempts} attempt${blockedAttempts > 1 ? 's' : ''} were blocked by the sovereign firewall. Review sandbox logs.`,
      timestamp: lastUpdated,
    })
  }

  // Sort: critical first, then by timestamp desc
  return alerts.sort((a, b) => {
    const sev: AlertSeverity[] = ['critical', 'high', 'medium', 'low']
    const diff = sev.indexOf(a.severity) - sev.indexOf(b.severity)
    if (diff !== 0) return diff
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
}

export function AlertsView() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [tasks, sovereignty] = await Promise.all([
        fetchTasks(false),
        fetchSovereigntyStatus(),
      ])
      const now = new Date().toISOString()
      setLastUpdated(now)
      setAlerts(buildAlerts(tasks, sovereignty.blockedAttempts ?? 0, now))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length
  const highCount = alerts.filter((a) => a.severity === 'high').length

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-1.5">
            <Icon icon={Bell} size={11} />
            System monitoring
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Alerts</h2>
          <p className="mt-1 text-xs text-muted">
            Derived from failed tasks and blocked egress attempts — no new backend surface
          </p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 border border-danger bg-danger/10 px-4 py-3">
          <Icon icon={XCircle} size={16} className="text-danger shrink-0" />
          <span className="text-xs font-semibold text-danger">
            {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} — immediate action required
          </span>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Critical', value: criticalCount, color: 'text-danger', icon: XCircle },
          { label: 'High', value: highCount, color: 'text-danger', icon: AlertTriangle },
          { label: 'Medium', value: alerts.filter((a) => a.severity === 'medium').length, color: 'text-warning', icon: Bell },
          { label: 'Total', value: alerts.length, color: 'text-muted', icon: Shield },
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
        {lastUpdated && (
          <div className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
            Updated {new Date(lastUpdated).toLocaleTimeString('en-IN')}
          </div>
        )}
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="border border-line bg-panel/30 p-12 text-center text-xs text-slate-500">
          Scanning for alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="border border-signal/20 bg-signal/5 p-12 text-center space-y-2">
          <div className="flex justify-center">
            <Icon icon={Shield} size={28} className="text-signal" />
          </div>
          <div className="text-sm font-semibold text-signal">All systems nominal</div>
          <div className="text-xs text-muted">No failed tasks or blocked egress attempts detected</div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const AIcon = SEVERITY_ICON[alert.severity]
            const sourceIcon = alert.source === 'egress-block' ? WifiOff : XCircle
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-4 border px-4 py-3 ${SEVERITY_STYLE[alert.severity]}`}
              >
                <Icon icon={AIcon} size={16} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold">{alert.title}</div>
                      <div className="mt-0.5 text-[10px] opacity-80">{alert.detail}</div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[9px] opacity-60">
                      {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-[8px] uppercase opacity-60">
                      <Icon icon={sourceIcon} size={9} />
                      {alert.source.replace('-', ' ')}
                    </span>
                    <span className="font-mono text-[8px] uppercase opacity-60">
                      · {alert.severity}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
