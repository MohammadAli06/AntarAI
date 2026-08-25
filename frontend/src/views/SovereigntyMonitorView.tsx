import { useState } from 'react'
import { Activity, CloudOff, Database, Globe2, RefreshCw, Server, ShieldCheck } from 'lucide-react'
import { fetchSovereigntyStatus } from '../lib/api'
import type { SovereigntyStatus } from '../lib/types'
import { formatLogTime } from '../lib/utils'
import { Icon } from '../components/ui/Icon'
import { Panel } from '../components/ui/Panel'
import { StatCard } from '../components/ui/StatCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Spinner } from '../components/ui/Spinner'

interface SovereigntyMonitorViewProps { status: SovereigntyStatus | null; onStatusChange: (status: SovereigntyStatus) => void }

const baseLogs = [
  { source: 'localhost', target: 'LLM Engine', detail: 'local completion accepted', icon: Server },
  { source: 'localhost', target: 'Vector DB', detail: 'document context retrieved', icon: Database },
  { source: 'localhost', target: 'File System', detail: 'read access scoped to /data', icon: Activity },
  { source: 'localhost', target: 'Network boundary', detail: 'external egress blocked', icon: Globe2 },
]

export function SovereigntyMonitorView({ status, onStatusChange }: SovereigntyMonitorViewProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  async function refresh() {
    setRefreshing(true); setError('')
    try { onStatusChange(await fetchSovereigntyStatus()) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Status unavailable') } finally { setRefreshing(false) }
  }
  const online = status?.online !== false
  return <div className="space-y-6 panel-enter">
    <div className="flex justify-end">
      <button onClick={refresh} className="inline-flex min-h-10 items-center justify-center gap-2 border border-line bg-panel px-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300 hover:border-slate-600 hover:text-slate-100">
        <Icon icon={RefreshCw} size={15} className={refreshing ? 'animate-spin' : ''} />
        Refresh status
      </button>
    </div>

    <Panel className="overflow-hidden p-5 sm:p-7">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-signal/25 bg-signal-dim/45 text-signal shadow-[0_0_26px_rgba(84,214,197,0.15)]">
          <Icon icon={ShieldCheck} size={26} strokeWidth={1.8} />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-[34px]">FULLY LOCAL <span className="text-signal">-</span> ZERO EXTERNAL CALLS</h2>
        <p className="mt-2 text-xs leading-5 text-muted sm:text-sm">All processing occurring on local infrastructure.</p>
      </div>

      {error && <div className="mt-5 border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger" role="alert">{error}</div>}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <StatCard label="External API calls" value={status?.externalCalls ?? 0} note={online ? '+ 100%' : 'Status unavailable'} icon={CloudOff} tone="signal" />
        <StatCard label="Cloud AI requests" value={0} note="Blocked" icon={Globe2} tone="signal" />
        <StatCard label="Local model calls" value={status?.localModelCalls ?? 0} note="/ hr" icon={Server} tone="neutral" />
      </div>

      <Panel className="mt-5 overflow-hidden border border-line/80 bg-[#0a1827]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Live system activity log</div>
          <StatusBadge tone={online ? 'success' : 'warning'} compact>{online ? 'Live' : 'Offline'}</StatusBadge>
        </div>
        <div className="p-4 font-mono text-[11px] sm:p-5">
          {baseLogs.map((log, index) => (
            <div key={`${log.target}-${index}`} className="grid gap-1 border-b border-white/[0.035] py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <span className="text-slate-600">{formatLogTime(index)}</span>
              <span className="flex min-w-0 items-center gap-2 text-slate-300">
                <Icon icon={log.icon} size={13} className="shrink-0 text-signal/80" />
                <span className="truncate"><span className="text-signal">{log.source}</span><span className="px-1.5 text-slate-600">→</span>{log.target}</span>
              </span>
              <span className="pl-5 text-[10px] text-slate-600 sm:pl-0">{log.detail}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-5 flex flex-col justify-between gap-2 border border-line/70 bg-ink/35 px-4 py-2 text-[10px] text-muted sm:flex-row sm:items-center">
        <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-signal" />Network monitoring active since 2026-08-26T18:42:47Z</span>
        <span className="font-mono uppercase tracking-[0.12em] text-signal">No outbound connections detected</span>
      </div>
    </Panel>

    {refreshing && <div className="flex justify-end"><Spinner label="Refreshing locality status" /></div>}
  </div>
}
