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
  Plus,
  SquareTerminal,
  Bot,
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
    { type: 'item', id: 'home', label: 'System Overview', icon: LayoutDashboard },
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
    { type: 'item', id: 'all-reviews', label: 'All Reviews', icon: ClipboardList },
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
    { type: 'item', id: 'workspace', label: 'Workspace', icon: Briefcase },
    { type: 'item', id: 'sovereignty-monitor', label: 'Sovereignty', icon: ShieldCheck },
    { type: 'item', id: 'audit-logs', label: 'Audit Logs', icon: ScrollText },
    { type: 'item', id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { type: 'section', label: 'AI Platform' },
    { type: 'item', id: 'models', label: 'Model Registry', icon: Cpu },
    { type: 'item', id: 'tools', label: 'Tool Registry', icon: Wrench },
    { type: 'item', id: 'knowledge-base', label: 'Knowledge Sources', icon: BookOpen },
    { type: 'section', label: 'Governance' },
    { type: 'item', id: 'users', label: 'Users & Roles', icon: Users },
    { type: 'item', id: 'policies', label: 'Policies', icon: BarChart3 },
    { type: 'item', id: 'approvals', label: 'Approval Queue', icon: FileCheck },
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
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
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
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded border border-signal/40 bg-signal-dim/55 text-signal shadow-[0_0_12px_rgba(249,115,22,0.2)]">
              <Bot size={15} strokeWidth={1.8} aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-signal" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-tight text-slate-100">Antar AI</span>
                <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">
                  SOVEREIGN-V1
                </span>
              </span>
            )}
          </button>
          <button
            onClick={onCloseMobile}
            className="flex size-8 items-center justify-center text-muted hover:text-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <Icon icon={PanelLeftClose} size={16} />
          </button>
        </div>

        {/* Role status pill */}
        {!collapsed && (
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 border border-signal/30 bg-signal/8 px-2 py-0.5 rounded">
              <span className="size-1.5 rounded-full bg-signal animate-pulse" />
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
                  <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-600">
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
                className={`group relative flex min-h-10 w-full items-center gap-2.5 rounded border px-3 text-left transition-colors duration-150 ${
                  collapsed ? 'lg:justify-center lg:px-0' : ''
                } ${
                  active
                    ? 'border-signal/30 bg-signal/12 text-signal font-semibold shadow-[inset_0_0_12px_rgba(249,115,22,0.06)]'
                    : 'border-transparent text-slate-400 hover:border-line hover:bg-panel/60 hover:text-slate-200'
                }`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? entry.label : undefined}
              >
                {active && <span className="absolute inset-y-2 left-0 w-0.5 bg-signal rounded-r" />}
                <Icon
                  icon={entry.icon}
                  size={15}
                  className={active ? 'text-signal' : 'text-slate-500 group-hover:text-slate-300'}
                />
                {!collapsed && (
                  <span className="min-w-0 flex-1 text-xs truncate">{entry.label}</span>
                )}
                {!collapsed && entry.badge !== undefined && entry.badge > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-signal/20 border border-signal/40 font-mono text-[8px] font-bold text-signal">
                    {entry.badge}
                  </span>
                )}
                {!collapsed && active && (
                  <Icon icon={ChevronRight} size={11} className="text-signal/70" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-line p-2.5 space-y-2 ${collapsed ? 'lg:px-1.5' : ''}`}>
          {/* New Instance Button */}
          <button
            onClick={() => navigate('workspace')}
            className={`flex w-full items-center justify-center gap-2 rounded bg-signal py-2 px-3 text-xs font-semibold text-action shadow-[0_0_16px_rgba(249,115,22,0.3)] transition-all hover:bg-orange-600 hover:shadow-[0_0_24px_rgba(249,115,22,0.45)] ${
              collapsed ? 'size-10 px-0' : ''
            }`}
            title="New Instance"
          >
            <Icon icon={Plus} size={15} />
            {!collapsed && <span>New Instance</span>}
          </button>

          {/* User & Controls */}
          <div className="space-y-0.5 pt-1">
            <button
              onClick={() => navigate('policies')}
              title="Operator Settings"
              className={`flex min-h-8 w-full items-center gap-2.5 rounded px-2.5 text-xs text-slate-400 hover:bg-panel hover:text-slate-200 transition-colors ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <Icon icon={Settings} size={13} />
              {!collapsed && <span className="text-[11px]">Operator Settings</span>}
            </button>

            <button
              onClick={() => navigate('tools')}
              title="Terminal / Tools"
              className={`flex min-h-8 w-full items-center gap-2.5 rounded px-2.5 text-xs text-slate-400 hover:bg-panel hover:text-slate-200 transition-colors ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <Icon icon={SquareTerminal} size={13} />
              {!collapsed && <span className="text-[11px]">Terminal</span>}
            </button>

            <button
              onClick={onLogout}
              title="Sign out"
              className={`flex min-h-8 w-full items-center gap-2.5 rounded px-2.5 text-left text-xs text-slate-400 hover:bg-danger/10 hover:text-danger transition-colors ${
                collapsed ? 'lg:justify-center lg:px-0' : ''
              }`}
            >
              <Icon icon={LogOut} size={13} />
              {!collapsed && <span className="text-[11px]">Sign out</span>}
            </button>

            <button
              onClick={onToggle}
              className={`hidden min-h-8 w-full items-center gap-2.5 rounded px-2.5 text-xs text-slate-500 hover:text-slate-300 lg:flex transition-colors ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={13} />
              {!collapsed && <span className="font-mono text-[9px] uppercase tracking-wider">Collapse</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded border border-line bg-panel text-muted hover:text-slate-100 lg:hidden"
      aria-label="Open navigation"
    >
      <Bot size={16} className="text-signal" />
    </button>
  )
}
