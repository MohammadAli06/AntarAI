import { Moon, Sun } from 'lucide-react'
import { Icon } from './Icon'
import type { Theme } from '../../lib/types'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
  compact?: boolean
}

export function ThemeToggle({ theme, onToggle, compact = false }: ThemeToggleProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${nextTheme} mode`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-10 items-center justify-center gap-2 border border-line bg-panel/60 px-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted transition-colors hover:border-signal/45 hover:text-signal ${compact ? 'size-10 px-0' : ''}`}
    >
      <Icon icon={theme === 'dark' ? Sun : Moon} size={15} />
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
