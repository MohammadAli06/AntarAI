import { LoaderCircle } from 'lucide-react'
import { Icon } from './Icon'

interface SpinnerProps {
  label?: string
}

export function Spinner({ label = 'Working' }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" role="status">
      <Icon icon={LoaderCircle} size={15} className="animate-spin text-signal" />
      {label}
    </span>
  )
}
