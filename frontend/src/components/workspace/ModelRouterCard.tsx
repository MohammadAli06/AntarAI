import { Route, Sparkles } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'
import { StatusBadge } from '../ui/StatusBadge'
import { getRoleLabel } from '../../lib/utils'
import type { ModelRole } from '../../lib/types'

interface ModelRouterCardProps {
  model: string
  role: ModelRole
}

export function ModelRouterCard({ model, role }: ModelRouterCardProps) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Icon icon={Route} size={15} className="text-signal" /><span className="eyebrow">Model router</span></div>
        <StatusBadge tone="success" compact>Resolved</StatusBadge>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0"><div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted">Task detected</div><div className="truncate text-sm font-medium text-slate-100">{getRoleLabel(role)}</div></div>
        <span className="h-px w-8 bg-line" />
        <div className="min-w-0 text-right"><div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted">Model selected</div><div className="flex items-center justify-end gap-1.5 truncate text-sm font-medium text-signal"><Icon icon={Sparkles} size={13} />{model}</div></div>
      </div>
    </Panel>
  )
}
