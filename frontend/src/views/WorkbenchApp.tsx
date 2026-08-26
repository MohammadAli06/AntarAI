import { useCallback, useEffect, useState } from 'react'
import { fetchModels, fetchOutputs, fetchSovereigntyStatus } from '../lib/api'
import { clearToken } from '../lib/auth'
import { AppShell } from '../components/layout/AppShell'
import { WorkspaceView } from './WorkspaceView'
import { ApprovalsView } from './ApprovalsView'
import { KnowledgeBaseView } from './KnowledgeBaseView'
import { SovereigntyMonitorView } from './SovereigntyMonitorView'
import { ModelsView } from './ModelsView'
import type { ApiErrorState, ModelInfo, OutputFile, SovereigntyStatus, Theme, ViewId } from '../lib/types'

interface WorkbenchAppProps {
  onLogout: () => void
  theme: Theme
  onToggleTheme: () => void
}

export function WorkbenchApp({ onLogout, theme, onToggleTheme }: WorkbenchAppProps) {
  const [activeView, setActiveView] = useState<ViewId>('workspace')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outputs, setOutputs] = useState<OutputFile[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(null)
  const [loading, setLoading] = useState({ outputs: true, models: true, sovereignty: true })
  const [errors, setErrors] = useState<ApiErrorState[]>([])

  const loadOutputs = useCallback(async () => {
    setLoading((current) => ({ ...current, outputs: true }))
    try { setOutputs(await fetchOutputs()); setErrors((current) => current.filter((error) => error.scope !== 'outputs')) }
    catch (error) { setErrors((current) => [...current.filter((item) => item.scope !== 'outputs'), { scope: 'outputs', message: error instanceof Error ? error.message : 'Outputs unavailable' }]) }
    finally { setLoading((current) => ({ ...current, outputs: false })) }
  }, [])

  const loadSovereignty = useCallback(async () => {
    setLoading((current) => ({ ...current, sovereignty: true }))
    try { setSovereignty(await fetchSovereigntyStatus()); setErrors((current) => current.filter((error) => error.scope !== 'sovereignty')) }
    catch (error) { setSovereignty({ externalCalls: 0, localModelCalls: 0, localFilesAccessed: 0, online: false }); setErrors((current) => [...current.filter((item) => item.scope !== 'sovereignty'), { scope: 'sovereignty', message: error instanceof Error ? error.message : 'Locality status unavailable' }]) }
    finally { setLoading((current) => ({ ...current, sovereignty: false })) }
  }, [])

  useEffect(() => {
    void Promise.allSettled([
      loadOutputs(),
      loadSovereignty(),
      fetchModels().then(setModels).catch((error) => { setErrors((current) => [...current, { scope: 'models', message: error instanceof Error ? error.message : 'Models unavailable' }]) }).finally(() => setLoading((current) => ({ ...current, models: false }))),
    ])
  }, [loadOutputs, loadSovereignty])

  return <AppShell activeView={activeView} onNavigate={setActiveView} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} sovereignty={sovereignty} onRefreshSovereignty={loadSovereignty} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((value) => !value)} onCloseMobile={() => setMobileOpen(false)}>
    {errors.some((error) => error.scope === 'sovereignty') && <div className="mb-5 flex items-center justify-between gap-3 border border-warning/25 bg-warning/10 px-4 py-3 text-xs text-warning" role="status"><span>Local API is not reachable. Start the backend to load live workspace data.</span><button onClick={loadSovereignty} className="font-mono text-[10px] uppercase tracking-[0.1em] underline underline-offset-4">Retry</button></div>}
    {activeView === 'workspace' && <WorkspaceView outputs={outputs} outputsLoading={loading.outputs} outputsError={errors.find((error) => error.scope === 'outputs')?.message} onRefreshOutputs={loadOutputs} sovereignty={sovereignty} onRefreshSovereignty={loadSovereignty} />}
    {activeView === 'approvals' && <ApprovalsView />}
    {activeView === 'knowledge-base' && <KnowledgeBaseView />}
    {activeView === 'sovereignty-monitor' && <SovereigntyMonitorView status={sovereignty} onStatusChange={setSovereignty} />}
    {activeView === 'models' && <ModelsView models={models} loading={loading.models} error={errors.find((error) => error.scope === 'models')?.message} />}
  </AppShell>
}