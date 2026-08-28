import {
  LayoutDashboard,
  Briefcase,
  ListTodo,
  FolderOutput,
  ShieldCheck,
  FileCheck,
  ClipboardList,
  CheckSquare,
  BookOpen,
  Network,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Settings,
  Users,
  Cpu,
  Wrench,
  ScrollText,
  BarChart3,
  AlertTriangle,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { Icon } from '../ui/Icon'
import type { UserRole, ViewId } from '../../lib/types'
import { getUser } from '../../lib/auth'

interface SidebarProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  onLogout: () => void
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  role: UserRole
}

// ── Nav definitions per role ──────────────────────────────────────────────────
type NavEntry =
  | { type: 'section'; label: string }
  | { type: 'item'; id: ViewId; label: string; icon: typeof LayoutDashboard; badge?: number; description?: string }

function getEngineerNav(): NavEntry[] {
  return [
    { type: 'item', id: 'home', label: 'Home', icon: LayoutDashboard },
    { type: 'item', id: 'workspace', label: 'Workspace', icon: Briefcase },
    { type: 'item', id: 'my-tasks', label: 'My Tasks', icon: ListTodo },
    { type: 'item', id: 'knowledge-base', label: 'Knowledge', icon: BookOpen },
    { type: 'item', id: 'deliverables', label: 'Deliverables', icon: FolderOutput },
    { type: 'item', id: 'sovereignty-monitor', label: 'Sovereignty', icon: ShieldCheck },
  ]
}

function getApproverNav(): NavEntry[] {
  return [
    { type: 'item', id: 'review-overview', label: 'Review Overview', icon: LayoutDashboard },
    { type: 'item', id: 'approvals', label: 'Approval Queue', icon: FileCheck, badge: 4 },
    { type: 'item', id: 'my-tasks', label: 'All Reviews', icon: ClipboardList },
    { type: 'item', id: 'knowledge-base', label: 'Knowledge', icon: BookOpen },
    { type: 'item', id: 'approved-outputs', label: 'Approved Outputs', icon: CheckSquare },
    { type: 'item', id: 'sovereignty-monitor', label: 'Sovereignty', icon: ShieldCheck },
    { type: 'item', id: 'audit-history', label: 'Audit History', icon: ScrollText },
  ]
}

function getAdminNav(): NavEntry[] {
  return [
    { type: 'item', id: 'admin-overview', label: 'System Overview', icon: LayoutDashboard },
    { type: 'section', label: 'Operations' },
    { type: 'item', id: 'sovereignty-monitor', label: 'Sovereignty', icon: ShieldCheck },
    { type: 'item', id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
    { type: 'item', id: 'audit-history', label: 'Alerts', icon: AlertTriangle },
    { type: 'section', label: 'AI Platform' },
    { type: 'item', id: 'models', label: 'Model Registry', icon: Cpu },
    { type: 'item', id: 'tools', label: 'Tool Registry', icon: Wrench },
    { type: 'item', id: 'knowledge-base', label: 'Knowledge Sources', icon: BookOpen },
    { type: 'section', label: 'Governance' },
    { type: 'item', id: 'users', label: 'Users & Roles', icon: Users },
    { type: 'item', id: 'policies', label: 'Policies', icon: BarChart3 },
    { type: 'item', id: 'approvals', label: 'Approval Rules', icon: FileCheck },
    { type: 'section', label: 'System' },
    { type: 'item', id: 'my-tasks', label: 'Compute', icon: Settings },
  ]
}

const ROLE_LABEL: Record<UserRole, string> = {
  engineer: 'Engineer',
  approver: 'Approver',
  admin: 'Admin',
}

export function Sidebar({ activeView, onNavigate, onLogout, collapsed, onToggle, mobileOpen, onCloseMobile, role }: SidebarProps) {
  const user = getUser()

  const nav: NavEntry[] =
    role === 'admin' ? getAdminNav() : role === 'approver' ? getApproverNav() : getEngineerNav()

  function navigate(id: ViewId) {
    onNavigate(id)
    onCloseMobile()
  }

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-navy transition-all duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          collapsed ? 'lg:w-[72px]' : 'w-[240px]'
        } ${mobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full'}`}
      >
        {/* Logo row */}
        <div className={`flex h-[60px] items-center border-b border-line px-4 ${collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'}`}>
          <button
            className="group flex min-h-10 items-center gap-2.5 text-left"
            onClick={() => navigate('home')}
            aria-label="Go to home"
          >
            <span className="relative flex size-7 shrink-0 items-center justify-center border border-signal/40 bg-signal-dim/55 text-signal">
              <Network size={14} strokeWidth={1.8} aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-signal" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-tight text-slate-100">AntarAI</span>
                <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.16em] text-muted">
                  Sovereign Workbench
                </span>
              </span>
            )}
          </button>
          <button
            onClick={onCloseMobile}
            className="flex size-9 items-center justify-center text-muted hover:text-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <Icon icon={PanelLeftClose} size={16} />
          </button>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-600">Control room</span>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                role === 'admin'
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : role === 'approver'
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-signal/30 bg-signal/10 text-signal'
              }`}
            >
              {ROLE_LABEL[role]}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {nav.map((entry, idx) => {
            if (entry.type === 'section') {
              if (collapsed) return null
              return (
                <div key={`sec-${idx}`} className="mt-4 mb-1 px-3 first:mt-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-700">
                    {entry.label}
                  </span>
                </div>
              )
            }

            const active = activeView === entry.id
            return (
              <button
                key={entry.id}
                onClick={() => navigate(entry.id)}
                className={`group relative flex min-h-10 w-full items-center gap-2.5 border px-3 text-left transition-colors duration-150 ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  active
                    ? 'border-signal/25 bg-signal-dim/40 text-slate-100'
                    : 'border-transparent text-muted hover:border-line hover:bg-panel/60 hover:text-slate-200'
                }`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? entry.label : undefined}
              >
                {active && <span className="absolute inset-y-2 left-0 w-0.5 bg-signal" />}
                <Icon
                  icon={entry.icon}
                  size={15}
                  className={active ? 'text-signal' : 'text-slate-500 group-hover:text-slate-300'}
                />
                {!collapsed && (
                  <span className="min-w-0 flex-1 text-xs font-medium truncate">{entry.label}</span>
                )}
                {!collapsed && entry.badge !== undefined && entry.badge > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-warning/20 border border-warning/40 font-mono text-[8px] font-bold text-warning">
                    {entry.badge}
                  </span>
                )}
                {!collapsed && active && (
                  <Icon icon={ChevronRight} size={11} className="text-signal/50" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-line p-2 space-y-1 ${collapsed ? 'lg:px-1' : ''}`}>
          {/* User chip */}
          <div
            className={`flex items-center gap-2 border border-line bg-ink/35 px-3 py-2 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <span className="size-1.5 rounded-full bg-signal" />
            {!collapsed && (
              <span className="flex-1 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                {user?.username || 'user'}
              </span>
            )}
            {!collapsed && (
              <span className="font-mono text-[8px] text-slate-700">
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>

          {/* Notification stub */}
          <button
            title="Notifications"
            className={`flex min-h-9 w-full items-center gap-2.5 border border-transparent px-3 text-muted transition-colors hover:border-line hover:bg-panel/60 hover:text-slate-200 ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <Icon icon={Bell} size={14} />
            {!collapsed && <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Notifications</span>}
          </button>

          {/* Sign out */}
          <button
            onClick={onLogout}
            title="Sign out"
            className={`flex min-h-9 w-full items-center gap-2.5 border border-transparent px-3 text-left text-muted transition-colors hover:border-danger/25 hover:bg-danger/10 hover:text-danger ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
          >
            <Icon icon={LogOut} size={14} />
            {!collapsed && (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Sign out</span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className={`hidden min-h-9 w-full items-center gap-2.5 px-3 text-muted hover:text-slate-100 lg:flex ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={14} />
            {!collapsed && (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Collapse</span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex size-9 items-center justify-center border border-line bg-panel text-muted hover:text-slate-100 lg:hidden"
      aria-label="Open navigation"
    >
      <Icon icon={Menu} size={16} />
    </button>
  )
}
