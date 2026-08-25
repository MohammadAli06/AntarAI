import type { ReactNode } from 'react'
import { CircleCheck, CircleDot, CircleX, LoaderCircle } from 'lucide-react'
import { Icon } from './Icon'

interface StatusBadgeProps {
  children: ReactNode
  tone?: 'success' | 'neutral' | 'warning' | 'danger' | 'loading'
  compact?: boolean
}

const toneStyles = {
  success: 'border-signal/25 bg-signal-dim/55 text-signal',
  neutral: 'border-line bg-raised/50 text-slate-300',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
  loading: 'border-signal/25 bg-signal-dim/55 text-signal',
}

export function StatusBadge({ children, tone = 'neutral', compact = false }: StatusBadgeProps) {
  const badgeIcon = tone === 'success' ? CircleCheck : tone === 'danger' ? CircleX : tone === 'loading' ? LoaderCircle : CircleDot
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${toneStyles[tone]} ${compact ? 'px-2 py-0.5' : ''}`}>
      <Icon icon={badgeIcon} size={12} className={tone === 'loading' ? 'animate-spin' : ''} />
      {children}
    </span>
  )
}
