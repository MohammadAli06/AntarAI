import { Database, LayoutDashboard, Menu, Network, PanelLeftClose, PanelLeftOpen, ShieldCheck, Cpu, FileCheck, LogOut } from 'lucide-react'
import { Icon } from '../ui/Icon'
import type { NavItem, ViewId, UserRole } from '../../lib/types'
import { getUser } from '../../lib/auth'

interface SidebarProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  onLogout: () => void
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const navigation: Array<NavItem & { icon: typeof LayoutDashboard }> = [
  { id: 'workspace', label: 'Workspace', description: 'Run a local task', icon: LayoutDashboard },
  { id: 'approvals', label: 'Approvals', description: 'Review AI document drafts', icon: FileCheck, roles: ['approver', 'admin'] },
  { id: 'knowledge-base', label: 'Knowledge Base', description: 'Browse local documents', icon: Database },
  { id: 'sovereignty-monitor', label: 'Sovereignty Monitor', description: 'Inspect local activity', icon: ShieldCheck },
  { id: 'models', label: 'Models', description: 'Review registered models', icon: Cpu, roles: ['admin'] },
]

export function Sidebar({ activeView, onNavigate, onLogout, collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
  const user = getUser()
  const role: UserRole = (user?.role as UserRole) || 'engineer'

  // Filter navigation items based on user role
  const visibleNav = navigation.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/55 lg:hidden" onClick={onCloseMobile} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-navy transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${collapsed ? 'lg:w-[78px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`flex h-[72px] items-center border-b border-line px-5 ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}>
          <button className="group flex min-h-11 items-center gap-3 text-left" onClick={() => onNavigate('workspace')} aria-label="Open workspace">
            <span className="relative flex size-8 shrink-0 items-center justify-center border border-signal/40 bg-signal-dim/55 text-signal">
              <Network size={17} strokeWidth={1.7} aria-hidden="true" />
              <span className="absolute -right-1 -top-1 size-1.5 bg-signal" />
            </span>
            <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="block text-[13px] font-semibold tracking-tight text-slate-100">AntarAI</span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted">MRPL workbench</span>
            </span>
          </button>
          <button onClick={onCloseMobile} className="flex size-10 items-center justify-center text-muted hover:text-slate-100 lg:hidden" aria-label="Close navigation">
            <Icon icon={PanelLeftClose} size={18} />
          </button>
        </div>

        <div className={`flex-1 px-3 py-6 ${collapsed ? 'lg:px-2' : ''}`}>
          <div className={`mb-3 flex items-center justify-between px-3 ${collapsed ? 'lg:hidden' : ''}`}>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Control room</span>
            <span className="rounded bg-signal/10 border border-signal/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-signal">
              {role}
            </span>
          </div>

          <nav aria-label="Primary navigation" className="space-y-1">
            {visibleNav.map((item) => {
              const active = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); onCloseMobile() }}
                  className={`group relative flex min-h-11 w-full items-center gap-3 border px-3 text-left transition-colors duration-150 ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${active ? 'border-signal/25 bg-signal-dim/40 text-slate-100' : 'border-transparent text-muted hover:border-line hover:bg-panel/60 hover:text-slate-200'}`}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-0.5 bg-signal" />}
                  <Icon icon={item.icon} size={17} className={active ? 'text-signal' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                    <span className="block truncate text-xs font-medium">{item.label}</span>
                    <span className={`mt-0.5 block truncate text-[10px] text-slate-600 ${active ? 'text-muted' : ''}`}>{item.description}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className={`border-t border-line p-3 ${collapsed ? 'lg:px-2' : ''}`}>
          <div className={`mb-2 flex items-center justify-between border border-line bg-raised/50 px-3 py-2 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-signal" />
              <span className={`font-mono text-[9px] uppercase tracking-[0.12em] text-muted ${collapsed ? 'lg:hidden' : ''}`}>
                {user?.username || 'User'}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className={`flex min-h-11 w-full items-center gap-3 border border-transparent px-3 text-left text-muted transition-colors hover:border-danger/25 hover:bg-danger/10 hover:text-danger ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <Icon icon={LogOut} size={16} />
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${collapsed ? 'lg:hidden' : ''}`}>Sign out</span>
          </button>
          <button onClick={onToggle} className={`hidden min-h-10 w-full items-center gap-3 px-3 text-muted hover:text-slate-100 lg:flex ${collapsed ? 'justify-center px-0' : ''}`} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={17} />
            <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${collapsed ? 'lg:hidden' : ''}`}>{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {

  return <button onClick={onClick} className="flex size-10 items-center justify-center border border-line bg-panel text-muted hover:text-slate-100 lg:hidden" aria-label="Open navigation"><Icon icon={Menu} size={18} /></button>
}
