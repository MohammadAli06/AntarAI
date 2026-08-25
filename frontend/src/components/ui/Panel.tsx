import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
}

export function Panel({ children, className = '', as: Element = 'section' }: PanelProps) {
  return <Element className={`panel-surface ${className}`}>{children}</Element>
}
