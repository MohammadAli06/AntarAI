import { useCallback, useEffect, useState } from 'react'
import {
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMe,
  fetchModels,
  fetchOutputs,
  fetchPolicies,
  fetchSovereigntyStatus,
  fetchTools,
  fetchUsers,
  switchDemoRole,
  updateConversation,
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
import { TaskListView } from './TaskListView'
import { AuditTrailView } from './AuditTrailView'
import { DeliverablesView } from './DeliverablesView'
import { AlertsView } from './AlertsView'
import { getUser, setToken, setUser } from '../lib/auth'
import { PermissionGate } from '../lib/permissions'
import type {
  ApiErrorState,
  ConversationSummary,
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

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationSearch, setConversationSearch] = useState('')

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

  const loadModels = useCallback(async () => {
    setLoading((c) => ({ ...c, models: true }))
    try { setModels(await fetchModels()); setErrors((c) => c.filter((e) => e.scope !== 'models')) }
    catch (err) { setErrors((c) => [...c.filter((e) => e.scope !== 'models'), { scope: 'models', message: err instanceof Error ? err.message : 'Models unavailable' }]) }
    finally { setLoading((c) => ({ ...c, models: false })) }
  }, [])

  const loadTools = useCallback(async () => {
    setLoading((c) => ({ ...c, tools: true }))
    try { setTools(await fetchTools()) }
    finally { setLoading((c) => ({ ...c, tools: false })) }
  }, [])

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true)
    try {
      const items = await fetchConversations({ q: conversationSearch || undefined, limit: 100 })
      setConversations(items)
    } catch {
      /* non-fatal */
    } finally {
      setConversationsLoading(false)
    }
  }, [conversationSearch])

  useEffect(() => {
    void Promise.allSettled([
      loadOutputs(),
      loadSovereignty(),
      loadModels(),
      loadTools(),
      fetchUsers()
        .then(setUsers)
        .catch(() => { /* 403 for non-admin — expected */ })
        .finally(() => setLoading((c) => ({ ...c, users: false }))),
      fetchPolicies()
        .then(setPolicies)
        .catch(() => { /* 403 for non-admin — expected */ })
        .finally(() => setLoading((c) => ({ ...c, policies: false }))),
    ])
  }, [loadOutputs, loadSovereignty, loadModels, loadTools])

  useEffect(() => { void loadConversations() }, [loadConversations])

  useEffect(() => {
    const t = window.setTimeout(() => { void loadConversations() }, 350)
    return () => window.clearTimeout(t)
  }, [conversationSearch, loadConversations])

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
            onNavigate={setActiveView}
            activeConversationId={activeConversationId}
            onConversationChange={setActiveConversationId}
            onConversationsRefresh={loadConversations}
          />
        )

      case 'approvals':
        return <ApprovalsView />

      // ── Engineer ────────────────────────────────────────────────────
      case 'my-tasks':
        return (
          <TaskListView
            scope={role === 'engineer' ? 'mine' : 'all'}
            title={role === 'engineer' ? 'My Tasks' : 'All Tasks'}
            description={
              role === 'engineer'
                ? 'Tasks you have submitted — all statuses'
                : 'All tasks across all engineers'
            }
            onNavigate={setActiveView}
          />
        )

      case 'deliverables':
        return <DeliverablesView />

      // ── Approver ────────────────────────────────────────────────────
      case 'all-reviews':
        return (
          <TaskListView
            scope="all"
            title="All Reviews"
            description="All tasks submitted by all engineers — review by status"
            onNavigate={setActiveView}
          />
        )

      case 'approved-outputs':
        return (
          <TaskListView
            scope="all"
            defaultStatus="approved"
            title="Approved Outputs"
            description="Tasks that have been approved and cleared for use"
            onNavigate={setActiveView}
          />
        )

      case 'audit-history':
        return (
          <AuditTrailView
            title="Audit History"
            description="Full audit log of all task transitions and approvals"
          />
        )

      // ── Admin ───────────────────────────────────────────────────────
      case 'audit-logs':
        return (
          <AuditTrailView
            title="Audit Logs"
            description="Immutable record of all AI-generated task transitions — admin view"
          />
        )

      case 'alerts':
        return <AlertsView />

      // ── Shared ──────────────────────────────────────────────────────
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
            isAdmin={role === 'admin'}
            onChanged={loadModels}
          />
        )

      case 'tools':
        return (
          <PermissionGate permission="model:read" fallback={<ForbiddenView title="Tool Registry" />}>
            <ToolsView tools={tools} loading={loading.tools} isAdmin={role === 'admin'} onChanged={loadTools} />
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

  async function handleNewConversation() {
    try {
      const conv = await createConversation('New conversation')
      setConversations((prev) => [conv, ...prev])
      setActiveConversationId(conv.id)
      setActiveView('workspace')
    } catch (err) {
      setErrors((c) => [...c, { scope: 'tasks', message: err instanceof Error ? err.message : 'Could not create conversation' }])
    }
  }

  async function handleRenameConversation(id: number, title: string) {
    try {
      const updated = await updateConversation(id, { title })
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch (err) {
      setErrors((c) => [...c, { scope: 'tasks', message: err instanceof Error ? err.message : 'Rename failed' }])
    }
  }

  async function handleDeleteConversation(id: number) {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) setActiveConversationId(null)
    } catch (err) {
      setErrors((c) => [...c, { scope: 'tasks', message: err instanceof Error ? err.message : 'Delete failed' }])
    }
  }

  async function handleArchiveConversation(id: number, archived: boolean) {
    try {
      const updated = await updateConversation(id, { archived })
      setConversations((prev) => {
        if (archived) return prev.filter((c) => c.id !== id)
        return prev.map((c) => (c.id === id ? updated : c))
      })
      if (archived && activeConversationId === id) setActiveConversationId(null)
    } catch (err) {
      setErrors((c) => [...c, { scope: 'tasks', message: err instanceof Error ? err.message : 'Archive failed' }])
    }
  }

  function handleSelectConversation(id: number) {
    setActiveConversationId(id)
    setActiveView('workspace')
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
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onRenameConversation={handleRenameConversation}
      onDeleteConversation={handleDeleteConversation}
      onArchiveConversation={handleArchiveConversation}
      onRefreshConversations={loadConversations}
      conversationsLoading={conversationsLoading}
      conversationSearch={conversationSearch}
      onConversationSearchChange={setConversationSearch}
    >
      {renderView()}
    </AppShell>
  )
}
