import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'
import { Panel } from './Panel'

interface StatCardProps {
  label: string
  value: string | number
  note: string
  icon: LucideIcon
  tone?: 'signal' | 'neutral' | 'warning'
}

export function StatCard({ label, value, note, icon, tone = 'neutral' }: StatCardProps) {
  const iconColor = tone === 'signal' ? 'text-signal' : tone === 'warning' ? 'text-warning' : 'text-muted'
  return (
    <Panel className="flex min-h-[136px] flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <Icon icon={icon} size={17} className={iconColor} />
      </div>
      <div>
        <div className="font-mono text-3xl font-medium tracking-[-0.06em] text-slate-100">{value}</div>
        <div className="mt-1 text-xs text-muted">{note}</div>
      </div>
    </Panel>
  )
}
