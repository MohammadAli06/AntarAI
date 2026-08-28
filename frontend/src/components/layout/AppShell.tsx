import type { ReactNode } from 'react'
import { Cpu, Shield } from 'lucide-react'
import { Sidebar, MobileMenuButton } from './Sidebar'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from '../ui/ThemeToggle'
import type { SovereigntyStatus, Theme, UserRole, ViewId } from '../../lib/types'
import { getUser } from '../../lib/auth'

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
  demoRole: UserRole
  onDemoRoleChange: (role: UserRole) => void
  demoMode: boolean
  switching?: boolean
}

const DEMO_ROLES: { value: UserRole; label: string }[] = [
  { value: 'engineer', label: 'Engineer' },
  { value: 'approver', label: 'Approver' },
  { value: 'admin', label: 'Admin' },
]

export function AppShell({
  activeView,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  children,
  sovereignty,
  onRefreshSovereignty: _onRefreshSovereignty,
  sidebarCollapsed,
  onToggleSidebar,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
  demoRole,
  onDemoRoleChange,
  demoMode,
  switching,
}: AppShellProps) {
  const user = getUser()
  const isAirGapped = sovereignty?.online !== false && sovereignty?.externalCalls === 0

  return (
    <div className="flex min-h-screen bg-ink text-slate-100">
      <Sidebar
        activeView={activeView}
        onNavigate={onNavigate}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={onCloseMobile}
        role={demoRole}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Persistent Header ──────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-md sm:px-5">
          {/* Left: mobile toggle + branding */}
          <div className="flex min-w-0 items-center gap-3">
            <MobileMenuButton onClick={onToggleMobile} />
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-tight text-slate-100">AntarAI</span>
                <span className="text-slate-700">/</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">MRPL · Engineering Workspace</span>
              </div>
            </div>
          </div>

          {/* Right: sovereignty pill + resource indicators + demo role + theme + user */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Sovereignty pill — always visible */}
            <div
              className={`hidden items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] sm:flex ${
                isAirGapped
                  ? 'border-signal/30 bg-signal/8 text-signal'
                  : 'border-warning/30 bg-warning/8 text-warning'
              }`}
            >
              <span className={`size-1.5 rounded-full ${isAirGapped ? 'bg-signal' : 'bg-warning animate-pulse'}`} />
              {isAirGapped ? 'Air-Gapped' : 'Status Unknown'}
            </div>

            {/* GPU indicator */}
            <div className="hidden items-center gap-1 xl:flex">
              <Icon icon={Cpu} size={12} className="text-muted" />
              <span className="font-mono text-[9px] text-muted">GPU 63%</span>
            </div>

            {/* Outbound counter — real measured value from sovereignty status */}
            <div className="hidden items-center gap-1 border border-line px-2 py-1 xl:flex">
              <span className="font-mono text-[9px] text-signal">{sovereignty?.externalCalls ?? 0}</span>
              <span className="font-mono text-[9px] text-slate-600">OUTBOUND</span>
            </div>

            {/* Demo role switcher — server-verified, hidden when demo mode is off */}
            {demoMode && (
              <div className="flex items-center gap-1.5 border border-warning/30 bg-warning/8 px-2 py-1">
                <span className="hidden font-mono text-[8px] uppercase tracking-[0.12em] text-warning sm:inline">Demo:</span>
                <select
                  value={demoRole}
                  onChange={(e) => onDemoRoleChange(e.target.value as UserRole)}
                  disabled={switching}
                  className="cursor-pointer bg-transparent font-mono text-[9px] uppercase tracking-[0.1em] text-warning outline-none disabled:opacity-50"
                  aria-label="Switch demo role (server-verified)"
                >
                  {DEMO_ROLES.map((r) => (
                    <option key={r.value} value={r.value} className="bg-navy text-slate-200 normal-case">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />

            {/* User avatar */}
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex size-8 items-center justify-center border border-line bg-panel font-mono text-[9px] uppercase tracking-wider text-muted hover:border-danger/40 hover:text-danger"
              aria-label={`Signed in as ${user?.username || 'user'} — click to sign out`}
            >
              <Icon icon={Shield} size={13} />
            </button>
          </div>
        </header>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
