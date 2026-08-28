import { useCallback, useEffect, useState } from 'react'
import { fetchModels, fetchOutputs, fetchSovereigntyStatus } from '../lib/api'
import { AppShell } from '../components/layout/AppShell'
import { WorkspaceView } from './WorkspaceView'
import { ApprovalsView } from './ApprovalsView'
import { KnowledgeBaseView } from './KnowledgeBaseView'
import { SovereigntyMonitorView } from './SovereigntyMonitorView'
import { ModelsView } from './ModelsView'
import { HomeDashboard } from '../features/home/HomeDashboard'
import { getUser } from '../lib/auth'
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

// Stub views for admin-only pages that aren't fully built yet
function StubView({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Coming soon</div>
        <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        <p className="text-xs text-muted max-w-sm">{description}</p>
      </div>
    </div>
  )
}

export function WorkbenchApp({ onLogout, theme, onToggleTheme }: WorkbenchAppProps) {
  const user = getUser()
  const initialRole = (user?.role as UserRole) || 'engineer'

  const [demoRole, setDemoRole] = useState<UserRole>(initialRole)
  const [activeView, setActiveView] = useState<ViewId>('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null)
  const [loading, setLoading] = useState({ outputs: true, models: true, sovereignty: true })
  const [errors, setErrors] = useState<ApiErrorState[]>([])
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null)

  // When demo role changes, navigate to role's default home view
  function handleDemoRoleChange(role: UserRole) {
    setDemoRole(role)
    setActiveView('home')
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
            role={demoRole}
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

      case 'my-tasks':
        return (
          <StubView
            title="My Tasks"
            description="View all tasks you have created — running, verifying, completed, pending approval."
          />
        )

      case 'deliverables':
      case 'approved-outputs':
        return (
          <StubView
            title="Deliverables"
            description="Browse all AI-generated deliverables: Word documents, Excel reports, code files, and presentations."
          />
        )

      case 'audit-history':
      case 'audit-logs':
        return (
          <StubView
            title="Audit Log"
            description="Full audit trail of all tasks, approvals, model invocations, and sovereignty events."
          />
        )

      case 'tools':
        return (
          <StubView
            title="Tool Registry"
            description="Manage local tools: Python Sandbox, OCR Engine, Document Generator, Excel, PPT."
          />
        )

      case 'users':
        return (
          <StubView
            title="Users & Roles"
            description="Manage users, assign roles (Engineer / Approver / Admin), and configure permissions."
          />
        )

      case 'policies':
        return (
          <StubView
            title="Policies"
            description="Define risk classification rules, approval thresholds, and governance policies."
          />
        )

      default:
        return (
          <HomeDashboard
            role={demoRole}
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
      demoRole={demoRole}
      onDemoRoleChange={handleDemoRoleChange}
    >
      {renderView()}
    </AppShell>
  )
}