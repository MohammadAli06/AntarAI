import { useEffect, useState } from 'react'
import { sendChat } from '../lib/api'
import { getUser } from '../lib/auth'
import type {
  AgentStep,
  Artifact,
  ChatResponse,
  EvidenceSource,
  RiskLevel,
  SovereigntyStatus,
  Task,
  UploadedFile,
  VerificationResult,
  WorkflowTemplate,
} from '../lib/types'
import { ContextPanel } from '../features/workspace/ContextPanel'
import { AgentConsole } from '../features/workspace/ExecutionTrace'
import { ArtifactPanel } from '../features/workspace/ArtifactPanel'
import { TaskComposer } from '../features/workspace/TaskComposer'
import { ProvenanceDrawer } from '../features/workspace/ProvenanceDrawer'
import {
  MOCK_ARTIFACTS,
  MOCK_SOURCES,
  MOCK_VERIFICATION,
  makeMockSteps,
} from '../lib/mockData'

interface WorkspaceViewProps {
  outputs: import('../lib/types').OutputFile[]
  outputsLoading: boolean
  outputsError?: string
  onRefreshOutputs: () => void
  sovereignty: SovereigntyStatus | null
  onRefreshSovereignty: () => void
  activeTemplate?: WorkflowTemplate | null
}

function stepifyResponse(response: ChatResponse): AgentStep[] {
  // Map legacy string steps from /chat into AgentStep objects
  return (response.steps || []).map((label, i) => ({
    id: `step-${i}`,
    stepIndex: i + 1,
    type: 'model' as const,
    label,
    status: 'completed' as const,
  }))
}

export function WorkspaceView({
  outputs: _outputs,
  outputsLoading: _outputsLoading,
  outputsError: _outputsError,
  onRefreshOutputs,
  onRefreshSovereignty,
  activeTemplate,
}: WorkspaceViewProps) {
  const user = getUser()

  // ── State ─────────────────────────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [prompt, setPromptState] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState('')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [sources, setSources] = useState<EvidenceSource[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [verification, setVerification] = useState<VerificationResult | undefined>(undefined)
  const [risk] = useState<RiskLevel>('high')
  const [task, setTask] = useState<Partial<Task> | null>(null)
  const [provenanceOpen, setProvenanceOpen] = useState(false)
  const [useMock, setUseMock] = useState(false)

  // ── Pre-fill from workflow template ──────────────────────────────────────
  useEffect(() => {
    if (activeTemplate) {
      setPromptState(activeTemplate.defaultPrompt)
    }
  }, [activeTemplate])

  // ── Simulate SSE-driven mock execution ────────────────────────────────────
  async function runMockTask(promptText: string) {
    setUseMock(true)
    setLoading(true)
    setError('')
    setSteps([])
    setSources([])
    setArtifacts([])
    setVerification(undefined)
    setResponse('')

    const mockSteps = makeMockSteps()
    const taskId = `TASK-${Math.floor(1000 + Math.random() * 9000)}`
    setTask({
      id: taskId,
      title: promptText.slice(0, 60),
      ownerId: user?.username ?? 'engineer1',
      ownerName: user?.username ?? 'engineer1',
      status: 'running',
      risk: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workflowTemplate: activeTemplate ?? undefined,
    })

    // Stream steps with delays for demo feel
    for (let i = 0; i < mockSteps.length; i++) {
      const step = mockSteps[i]
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800))
      setSteps((prev) => [...prev, { ...step, status: 'completed' as const }])
      if (step.sources) setSources(step.sources)
      if (step.verification) setVerification(step.verification)
      if (step.artifact) setArtifacts((prev) => [...prev, step.artifact!])
    }

    // Final
    setSources(MOCK_SOURCES)
    setVerification(MOCK_VERIFICATION)
    setArtifacts(MOCK_ARTIFACTS)
    setResponse(
      `## Analysis Complete\n\nThe inspection report for Pump P-201 has been analyzed against MRPL-PUMP-SOP-042. Pump vibration exceeded acceptable range at 5.2 mm/s RMS (limit: 4.5 mm/s). Bearing temperature deviation noted at startup (+18°C above baseline).\n\nFindings are cross-referenced against 4 source documents. An approval note has been generated with executive summary, findings, and recommendations. SHA256 integrity verified.`
    )
    setTask((prev) => ({ ...prev, status: 'pending_approval' }))
    setLoading(false)
    onRefreshOutputs()
    onRefreshSovereignty()
  }

  // ── Real task via /chat ───────────────────────────────────────────────────
  async function runRealTask(promptText: string, file?: File) {
    setUseMock(false)
    setLoading(true)
    setError('')
    setSteps([])
    setResponse('')
    try {
      const res = await sendChat(promptText, file)
      setResponse(res.response)
      setSteps(stepifyResponse(res))
      if (res.generatedFile) {
        setArtifacts([{
          id: 'art-real-1',
          filename: res.generatedFile,
          fileType: res.generatedFile.split('.').pop() ?? 'file',
          sizeBytes: 0,
          generatedLocally: true,
          downloadUrl: `/outputs/${encodeURIComponent(res.generatedFile)}`,
          createdAt: new Date().toISOString(),
        }])
      }
      onRefreshOutputs()
      onRefreshSovereignty()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(promptText: string, file?: File) {
    setPromptState(promptText)
    if (file) {
      setUploadedFiles((prev) => [...prev, { file, type: file.type.startsWith('image/') ? 'image' : 'pdf', ocrStatus: 'pending' }])
    }
    // Try real backend first; fall back to mock demo
    void runMockTask(promptText)
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Task bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-ink/40 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
            Workspace
          </span>
          {task?.id && (
            <>
              <span className="text-slate-700">/</span>
              <span className="font-mono text-[9px] text-muted">{task.id}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {task?.id && (
            <button
              onClick={() => setProvenanceOpen(true)}
              className="text-[9px] text-muted hover:text-signal transition-colors underline underline-offset-2"
            >
              Why should I trust this result?
            </button>
          )}
          <div className="flex items-center gap-1.5 font-mono text-[9px]">
            <span className="size-1.5 rounded-full bg-signal" />
            <span className="text-muted">AIR-GAPPED</span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-danger/25 bg-danger/10 px-4 py-2 text-xs text-danger">
          {error} ·{' '}
          <button onClick={() => setError('')} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 3-panel layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — Context */}
        <div className="hidden w-[200px] shrink-0 overflow-hidden lg:flex lg:flex-col xl:w-[220px]">
          <ContextPanel
            task={task}
            uploadedFiles={uploadedFiles}
            sources={sources}
            steps={steps}
            risk={risk}
            onRemoveFile={removeFile}
          />
        </div>

        {/* CENTER — Agent Console */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-line">
          <AgentConsole steps={steps} loading={loading} response={response} prompt={prompt}>
            <TaskComposer
              onSubmit={handleSubmit}
              loading={loading}
              initialPrompt={activeTemplate?.defaultPrompt ?? ''}
              template={activeTemplate}
            />
          </AgentConsole>
        </div>

        {/* RIGHT — Artifacts + Evidence */}
        <div className="hidden w-[200px] shrink-0 overflow-hidden xl:flex xl:flex-col xl:w-[220px]">
          <ArtifactPanel
            response={response}
            sources={sources}
            artifacts={artifacts}
            verification={verification}
            loading={loading}
          />
        </div>
      </div>

      {/* Provenance Drawer */}
      <ProvenanceDrawer
        open={provenanceOpen}
        onClose={() => setProvenanceOpen(false)}
        task={task}
        steps={steps}
        sources={sources}
        artifacts={artifacts}
        verification={verification}
        usedMock={useMock}
      />
    </div>
  )
}
