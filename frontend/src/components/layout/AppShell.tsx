import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { Icon } from '../ui/Icon'
import { StatusBadge } from '../ui/StatusBadge'
import { ThemeToggle } from '../ui/ThemeToggle'
import type { SovereigntyStatus, Theme, ViewId } from '../../lib/types'

interface AppShellProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  onLogout: () => void
  theme: Theme
  onToggleTheme: () => void
  children: ReactNode
  sovereignty: SovereigntyStatus | null
  onRefreshSovereignty: () => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  mobileOpen: boolean
  onToggleMobile: () => void
  onCloseMobile: () => void
}

const pageTitles: Record<ViewId, { title: string; detail: string }> = {
  workspace: { title: 'Workspace', detail: 'Confidential task execution' },
  approvals: { title: 'Approvals', detail: 'Supervisor review & document authorization' },
  'knowledge-base': { title: 'Knowledge Base', detail: 'Local document index' },
  'sovereignty-monitor': { title: 'Sovereignty Monitor', detail: 'Runtime locality and audit trail' },
  models: { title: 'Models', detail: 'On-premise model registry' },
}

export function AppShell({ activeView, onNavigate, onLogout, theme, onToggleTheme, children, sovereignty, onRefreshSovereignty, sidebarCollapsed, onToggleSidebar, mobileOpen, onToggleMobile, onCloseMobile }: AppShellProps) {
  const page = pageTitles[activeView]
  const isLocal = sovereignty?.online !== false

  return (
    <div className="flex min-h-screen bg-ink text-slate-100">
      <Sidebar activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} collapsed={sidebarCollapsed} onToggle={onToggleSidebar} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <MobileMenuButton onClick={onToggleMobile} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-sm font-semibold tracking-tight text-slate-100 sm:text-base">Sovereign AI Workbench</h1>
                <span className="hidden border-l border-line pl-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600 sm:inline">MRPL / PS 26117</span>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{page.title} <span className="px-1 text-slate-700">/</span> {page.detail}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button onClick={onRefreshSovereignty} className="hidden size-9 items-center justify-center text-muted hover:text-slate-100 sm:flex" aria-label="Refresh locality status" title="Refresh locality status"><Icon icon={RefreshCw} size={15} /></button>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
            <StatusBadge tone={isLocal ? 'success' : 'warning'} compact>{isLocal ? 'Fully local' : 'Status unavailable'}</StatusBadge>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
