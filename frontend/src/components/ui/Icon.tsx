import type { LucideIcon } from 'lucide-react'

interface IconProps {
  icon: LucideIcon
  size?: number
  strokeWidth?: number
  className?: string
}

export function Icon({ icon: IconComponent, size = 18, strokeWidth = 1.8, className }: IconProps) {
  return <IconComponent aria-hidden="true" size={size} strokeWidth={strokeWidth} className={className} />
}
