import { useCallback, useEffect, useState } from 'react'
import {
  fetchMe,
  fetchModels,
  fetchOutputs,
  fetchPolicies,
  fetchSovereigntyStatus,
  fetchTools,
  fetchUsers,
  switchDemoRole,
} from '../lib/api'
import type { ToolInfo, UserInfo } from '../lib/api'
import { AppShell } from '../components/layout/AppShell'
import { WorkspaceView } from './WorkspaceView'
import { ApprovalsView } from './ApprovalsView'
import { KnowledgeBaseView } from './KnowledgeBaseView'
import { SovereigntyMonitorView } from './SovereigntyMonitorView'
import { ModelsView } from './ModelsView'
import { ToolsView } from './ToolsView'
import { UsersView } from './UsersView'
import { PoliciesView } from './PoliciesView'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { getUser, setToken, setUser } from '../lib/auth'
import { PermissionGate } from '../lib/permissions'
import type {
  ApiErrorState,
  ModelInfo,
  OutputFile,
  SovereigntyStatus,
  Theme,
  UserRole,
  ViewId,
  WorkflowTemplate,
} from '../lib/types'

interface WorkbenchAppProps {
  onLogout: () => void
  theme: Theme
  onToggleTheme: () => void
}

function ForbiddenView({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-danger">Access denied</div>
        <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        <p className="text-xs text-muted max-w-sm">Your signed role does not permit this view. Switch role (demo) or sign in as an admin.</p>
      </div>
    </div>
  )
}

export function WorkbenchApp({ onLogout, theme, onToggleTheme }: WorkbenchAppProps) {
  const stored = getUser()
  const [role, setRole] = useState<UserRole>((stored?.role as UserRole) || 'engineer')
  const [demoMode, setDemoMode] = useState(true)
  const [switching, setSwitching] = useState(false)

  const [activeView, setActiveView] = useState<ViewId>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [users, setUsers] = useState<UserInfo[]>([])
  const [policies, setPolicies] = useState<Record<string, unknown>>({})
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null)
  const [loading, setLoading] = useState({ outputs: true, models: true, sovereignty: true, tools: true, users: true, policies: true })
  const [errors, setErrors] = useState<ApiErrorState[]>([])
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null)

  // Sync the authoritative (signed-token) role + demo flag from the server.
  useEffect(() => {
    fetchMe()
      .then((me) => {
        setRole(me.role as UserRole)
        setDemoMode(me.demoMode)
        setUser({ username: me.username, role: me.role, demo: me.demo })
      })
      .catch(() => { /* 401 handled globally */ })
  }, [])

  // Demo role switch — server re-issues a signed, demo-scoped token.
  async function handleDemoRoleChange(newRole: UserRole) {
    if (newRole === role) return
    setSwitching(true)
    try {
      const res = await switchDemoRole(newRole)
      setToken(res.access_token)
      setUser({ username: res.username, role: res.role, demo: true })
      setRole(res.role as UserRole)
      setActiveView('home')
    } catch (err) {
      setErrors((c) => [...c, { scope: 'tasks', message: err instanceof Error ? err.message : 'Role switch failed' }])
    } finally {
      setSwitching(false)
    }
  }

  const loadOutputs = useCallback(async () => {
    setLoading((c) => ({ ...c, outputs: true }))
    try {
      setOutputs(await fetchOutputs())
      setErrors((c) => c.filter((e) => e.scope !== 'outputs'))
    } catch (err) {
      setErrors((c) => [...c.filter((e) => e.scope !== 'outputs'), { scope: 'outputs', message: err instanceof Error ? err.message : 'Outputs unavailable' }])
    } finally {
      setLoading((c) => ({ ...c, outputs: false }))
    }
  }, [])

  const loadSovereignty = useCallback(async () => {
    setLoading((c) => ({ ...c, sovereignty: true }))
    try {
      setSovereignty(await fetchSovereigntyStatus())
      setErrors((c) => c.filter((e) => e.scope !== 'sovereignty'))
    } catch {
      setSovereignty({ externalCalls: 0, localModelCalls: 0, localFilesAccessed: 0, online: false })
    } finally {
      setLoading((c) => ({ ...c, sovereignty: false }))
    }
  }, [])

  useEffect(() => {
    void Promise.allSettled([
      loadOutputs(),
      loadSovereignty(),
      fetchModels()
        .then(setModels)
        .catch((err) => setErrors((c) => [...c, { scope: 'models', message: err instanceof Error ? err.message : 'Models unavailable' }]))
        .finally(() => setLoading((c) => ({ ...c, models: false }))),
      fetchTools()
        .then(setTools)
        .catch(() => { /* non-admin or unavailable */ })
        .finally(() => setLoading((c) => ({ ...c, tools: false }))),
      fetchUsers()
        .then(setUsers)
        .catch(() => { /* 403 for non-admin — expected */ })
        .finally(() => setLoading((c) => ({ ...c, users: false }))),
      fetchPolicies()
        .then(setPolicies)
        .catch(() => { /* 403 for non-admin — expected */ })
        .finally(() => setLoading((c) => ({ ...c, policies: false }))),
    ])
  }, [loadOutputs, loadSovereignty])

  function handleStartWorkflow(template: WorkflowTemplate) {
    setActiveTemplate(template)
    setActiveView('workspace')
  }

  function renderView() {
    switch (activeView) {
      case 'home':
      case 'review-overview':
      case 'admin-overview':
        return (
          <HomeDashboard
            role={role}
            onNavigate={setActiveView}
            sovereignty={sovereignty}
            onStartWorkflow={handleStartWorkflow}
          />
        )

      case 'workspace':
        return (
          <WorkspaceView
            outputs={outputs}
            outputsLoading={loading.outputs}
            outputsError={errors.find((e) => e.scope === 'outputs')?.message}
            onRefreshOutputs={loadOutputs}
            sovereignty={sovereignty}
            onRefreshSovereignty={loadSovereignty}
            activeTemplate={activeTemplate}
          />
        )

      case 'approvals':
        return <ApprovalsView />

      case 'knowledge-base':
        return <KnowledgeBaseView />

      case 'sovereignty-monitor':
        return (
          <SovereigntyMonitorView
            status={sovereignty}
            onStatusChange={setSovereignty}
          />
        )

      case 'models':
        return (
          <ModelsView
            models={models}
            loading={loading.models}
            error={errors.find((e) => e.scope === 'models')?.message}
          />
        )

      case 'tools':
        return (
          <PermissionGate permission="model:read" fallback={<ForbiddenView title="Tool Registry" />}>
            <ToolsView tools={tools} loading={loading.tools} />
          </PermissionGate>
        )

      case 'users':
        return (
          <PermissionGate permission="user:manage" fallback={<ForbiddenView title="Users & Roles" />}>
            <UsersView users={users} loading={loading.users} />
          </PermissionGate>
        )

      case 'policies':
        return (
          <PermissionGate permission="admin:access" fallback={<ForbiddenView title="Policies" />}>
            <PoliciesView policies={policies} loading={loading.policies} />
          </PermissionGate>
        )

      default:
        return (
          <HomeDashboard
            role={role}
            onNavigate={setActiveView}
            sovereignty={sovereignty}
            onStartWorkflow={handleStartWorkflow}
          />
        )
    }
  }

  return (
    <AppShell
      activeView={activeView}
      onNavigate={setActiveView}
      onLogout={onLogout}
      theme={theme}
      onToggleTheme={onToggleTheme}
      sovereignty={sovereignty}
      onRefreshSovereignty={loadSovereignty}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
      mobileOpen={mobileOpen}
      onToggleMobile={() => setMobileOpen((v) => !v)}
      onCloseMobile={() => setMobileOpen(false)}
      demoRole={role}
      onDemoRoleChange={handleDemoRoleChange}
      demoMode={demoMode}
      switching={switching}
    >
      {renderView()}
    </AppShell>
  )
}
