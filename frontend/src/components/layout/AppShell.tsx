import type { ReactNode } from 'react'
import { Bell, Cpu, Lock, Shield, ShieldCheck, User } from 'lucide-react'
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
    <div className="flex h-screen overflow-hidden bg-ink text-slate-100 selection:bg-signal selection:text-white">
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Persistent Header ──────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-md sm:px-6">
          {/* Left: mobile toggle + title */}
          <div className="flex min-w-0 items-center gap-3">
            <MobileMenuButton onClick={onToggleMobile} />
            <div className="flex items-center gap-2 font-mono">
              <span className="text-xs font-bold tracking-tight text-slate-100 sm:text-sm">
                Antar AI // SYSTEM_ROOT
              </span>
            </div>
          </div>

          {/* Center/Right: high-tech status pills + demo controls */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Air-gapped pill */}
            <div className="flex items-center gap-1.5 rounded border border-signal/40 bg-signal/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-signal">
              <Icon icon={ShieldCheck} size={11} className="text-signal" />
              <span>{isAirGapped ? 'AIR-GAPPED' : 'ONLINE'}</span>
            </div>

            {/* GPU indicator */}
            <div className="hidden items-center gap-1.5 rounded border border-line bg-panel/60 px-2.5 py-1 font-mono text-[9px] text-slate-300 md:flex">
              <Icon icon={Cpu} size={11} className="text-signal" />
              <span>GPU 82%</span>
            </div>

            {/* Isolated pill */}
            <div className="hidden items-center gap-1.5 rounded border border-line bg-panel/60 px-2.5 py-1 font-mono text-[9px] text-slate-300 lg:flex">
              <Icon icon={Lock} size={11} className="text-signal" />
              <span>ISOLATED</span>
            </div>

            {/* Outbound counter */}
            <div className="hidden items-center gap-1.5 rounded border border-line bg-panel/40 px-2.5 py-1 font-mono text-[9px] xl:flex">
              <span className="font-bold text-signal">{sovereignty?.externalCalls ?? 0}</span>
              <span className="text-slate-500">OUTBOUND</span>
            </div>

            {/* Demo role switcher */}
            {demoMode && (
              <div className="flex items-center gap-1.5 rounded border border-signal/30 bg-signal/10 px-2 py-1">
                <span className="hidden font-mono text-[8px] uppercase tracking-[0.12em] text-signal sm:inline">Role:</span>
                <select
                  value={demoRole}
                  onChange={(e) => onDemoRoleChange(e.target.value as UserRole)}
                  disabled={switching}
                  className="cursor-pointer bg-transparent font-mono text-[9px] uppercase tracking-[0.1em] text-signal outline-none disabled:opacity-50"
                  aria-label="Switch role"
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

            {/* User button */}
            <button
              onClick={onLogout}
              title={`Signed in as ${user?.username || 'admin'} · Click to logout`}
              className="flex size-8 items-center justify-center rounded border border-line bg-panel font-mono text-[10px] text-slate-300 hover:border-signal/50 hover:text-signal transition-colors"
            >
              <Icon icon={User} size={14} />
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
