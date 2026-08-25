import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Icon } from './Icon'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="mb-3 flex size-9 items-center justify-center border border-line bg-raised/45 text-muted">
        <Icon icon={Inbox} size={17} />
      </span>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
