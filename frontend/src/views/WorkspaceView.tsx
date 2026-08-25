import { useEffect, useState } from 'react'
import { Activity, ShieldCheck } from 'lucide-react'
import { sendChat } from '../lib/api'
import { getRoleLabel } from '../lib/utils'
import type { ChatResponse, OutputFile, UploadedFile, ModelRole, SovereigntyStatus } from '../lib/types'
import { Icon } from '../components/ui/Icon'
import { StatusBadge } from '../components/ui/StatusBadge'
import { TaskInputPanel } from '../components/workspace/TaskInputPanel'
import { ModelRouterCard } from '../components/workspace/ModelRouterCard'
import { AgentTimeline } from '../components/workspace/AgentTimeline'
import { ResponsePanel } from '../components/workspace/ResponsePanel'
import { OutputsList } from '../components/workspace/OutputsList'
import { FilePreviewPanel } from '../components/workspace/FilePreviewPanel'
import { DocumentAnalysisPanel } from '../components/workspace/DocumentAnalysisPanel'
import { SandboxPanel } from '../components/workspace/SandboxPanel'

interface WorkspaceViewProps {
  outputs: OutputFile[]
  outputsLoading: boolean
  outputsError?: string
  onRefreshOutputs: () => void
  sovereignty: SovereigntyStatus | null
  onRefreshSovereignty: () => void
}

export function WorkspaceView({ outputs, outputsLoading, outputsError, onRefreshOutputs, sovereignty, onRefreshSovereignty }: WorkspaceViewProps) {
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<ChatResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')

  useEffect(() => () => { if (selectedFile?.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl) }, [selectedFile])

  function selectFile(file: File | null) {
    if (!file) { setSelectedFile(null); return }
    const isImage = file.type.startsWith('image/')
    setSelectedFile({ file, type: isImage ? 'image' : 'pdf' })
  }

  async function runTask(message: string, file?: File) {
    setLoading(true); setError(''); setResult(null)
    try {
      setLastPrompt(message)
      const response = await sendChat(message, file)
      setResult(response)
      onRefreshOutputs()
      onRefreshSovereignty()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The local API request failed.')
    } finally { setLoading(false) }
  }

  const role: ModelRole = result?.role || 'general'
  const model = result?.modelUsed || 'Awaiting task'

  function runDocumentAnalysis() {
    const prompt = 'Analyze this engineering document, extract key findings, severity, and recommended maintenance actions.'
    void runTask(prompt, selectedFile?.file)
  }

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="eyebrow mb-2">Operational workspace</div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Sovereign AI Workbench</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted sm:text-sm">Document analysis and code execution, fully local and auditable.</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge tone="success"><Icon icon={ShieldCheck} size={12} /> Fully local</StatusBadge>
      </div>
    </div>

    <DocumentAnalysisPanel
      selectedFile={selectedFile}
      response={result?.response || ''}
      steps={result?.steps || []}
      loading={loading}
      onGenerateReport={runDocumentAnalysis}
    />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] xl:items-start">
      <div className="space-y-5">
        <TaskInputPanel onSubmit={runTask} loading={loading} selectedFile={selectedFile} onFileSelect={selectFile} />
        {selectedFile && <FilePreviewPanel selectedFile={selectedFile} onRemove={() => selectFile(null)} />}
        <ResponsePanel response={result?.response || ''} loading={loading} error={error} />
        <SandboxPanel objective={lastPrompt} response={result?.response || ''} loading={loading} steps={result?.steps || []} />
      </div>

      <div className="space-y-5">
        <ModelRouterCard model={model} role={role} />
        <AgentTimeline steps={result?.steps || []} loading={loading} />
        <div className="flex items-center gap-2 border border-line bg-panel/35 px-4 py-3 text-[10px] text-muted">
          <Icon icon={Activity} size={14} className="text-signal" />
          <span>{result ? `${getRoleLabel(role)} routed through the local model registry.` : 'Task routing is ready when you are.'}</span>
        </div>
        <OutputsList outputs={outputs} loading={outputsLoading} error={outputsError} onRefresh={onRefreshOutputs} />
        <div className="border-l-2 border-signal/50 bg-signal-dim/20 px-4 py-3 text-[11px] leading-5 text-muted">
          <span className="font-medium text-signal">Sovereignty by default.</span> {sovereignty?.localFilesAccessed || 0} local files accessed this session, {sovereignty?.localModelCalls || 0} model calls recorded.
        </div>
      </div>
    </div>
  </div>
}
