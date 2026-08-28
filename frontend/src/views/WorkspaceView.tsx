import { useEffect, useRef, useState } from 'react'
import { streamChat } from '../lib/api'
import { getUser } from '../lib/auth'
import type {
  AgentStep,
  Artifact,
  EvidenceSource,
  RiskLevel,
  SovereigntyStatus,
  StepStatus,
  StepType,
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

interface WorkspaceViewProps {
  outputs: import('../lib/types').OutputFile[]
  outputsLoading: boolean
  outputsError?: string
  onRefreshOutputs: () => void
  sovereignty: SovereigntyStatus | null
  onRefreshSovereignty: () => void
  activeTemplate?: WorkflowTemplate | null
}

// Backend stream event (loosely typed — the reducer switches on `type`).
interface StreamEvent {
  type: string
  taskId?: string
  stepId?: string
  data?: Record<string, any>
}

// stepId → trace-card metadata
const STEP_META: Record<string, { type: StepType; label: string }> = {
  plan: { type: 'plan', label: 'Analyze request' },
  route: { type: 'route', label: 'Route task to model' },
  ocr: { type: 'ocr', label: 'Extract document text' },
  knowledge: { type: 'knowledge', label: 'Retrieve relevant knowledge' },
  model: { type: 'model', label: 'Generate response' },
  'tool-doc': { type: 'tool', label: 'Generate document' },
  'tool-sandbox': { type: 'tool', label: 'Execute code in sandbox' },
  verification: { type: 'verification', label: 'Verify output' },
  artifact: { type: 'artifact', label: 'Deliver artifacts' },
  approval: { type: 'approval', label: 'Await approval' },
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
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (activeTemplate) setPromptState(activeTemplate.defaultPrompt)
  }, [activeTemplate])

  // Upsert a trace step by stepId, merging patch fields.
  function upsertStep(stepId: string, status: StepStatus, patch: Partial<AgentStep> = {}) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], status, ...patch }
        return next
      }
      const meta = STEP_META[stepId]
      return [
        ...prev,
        {
          id: stepId,
          stepIndex: prev.length + 1,
          type: meta?.type ?? 'plan',
          label: meta?.label ?? stepId,
          status,
          ...patch,
        },
      ]
    })
  }

  // Real streaming task via /chat/stream (SSE).
  async function runRealStream(promptText: string, file?: File) {
    setLoading(true)
    setError('')
    setSteps([])
    setSources([])
    setArtifacts([])
    setVerification(undefined)
    setResponse('')
    setTask({
      id: 'TASK-…',
      title: promptText.slice(0, 60),
      ownerId: user?.username ?? 'engineer1',
      ownerName: user?.username ?? 'engineer1',
      status: 'planning',
      risk: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workflowTemplate: activeTemplate ?? undefined,
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(promptText, file, (raw) => {
        const ev = raw as unknown as StreamEvent
        const sid = ev.stepId
        const d = ev.data ?? {}

        switch (ev.type) {
          case 'task.created':
            setTask((prev) => ({ ...prev, id: ev.taskId ?? prev?.id }))
            upsertStep('plan', 'completed', { durationMs: 1 })
            break
          case 'router.started':
            upsertStep('route', 'running')
            break
          case 'router.completed':
            upsertStep('route', 'completed', { modelRoute: d.modelRoute })
            break
          case 'ocr.started':
            upsertStep('ocr', 'running')
            break
          case 'ocr.completed':
            upsertStep('ocr', 'completed', { ocrResult: d.ocrResult })
            break
          case 'knowledge.started':
            upsertStep('knowledge', 'running')
            break
          case 'knowledge.completed':
            upsertStep('knowledge', 'completed', { sources: d.sources })
            setSources(d.sources ?? [])
            break
          case 'model.started':
            upsertStep('model', 'running', { detail: d.model })
            break
          case 'model.completed':
            upsertStep('model', 'completed', { detail: d.detail })
            setResponse(d.response ?? '')
            break
          case 'model.failed':
            upsertStep('model', 'failed', { error: d.error })
            break
          case 'tool.started':
            if (sid) upsertStep(sid, 'running')
            break
          case 'tool.completed':
            if (sid) upsertStep(sid, 'completed', { toolRun: d.toolRun })
            break
          case 'tool.failed':
            if (sid) upsertStep(sid, 'failed', { toolRun: d.toolRun, error: 'tool failed' })
            break
          case 'verification.started':
            upsertStep('verification', 'running')
            break
          case 'verification.completed':
            upsertStep('verification', 'completed', { verification: d.verification })
            setVerification(d.verification)
            break
          case 'verification.failed':
            upsertStep('verification', 'failed', { error: 'verification failed' })
            break
          case 'artifact.created': {
            const art = d.artifact as Artifact | undefined
            upsertStep('artifact', 'completed', { artifact: art })
            if (art) {
              setArtifacts((prev) => (prev.find((a) => a.id === art.id) ? prev : [...prev, art]))
            }
            break
          }
          case 'approval.required':
            upsertStep('approval', 'completed')
            setTask((prev) => ({
              ...prev,
              status: 'pending_approval',
              requiresApproval: true,
              risk: d.risk,
              evidenceCount: d.evidenceCount,
              approval: {
                approvedBy: '',
                approvedAt: '',
                taskId: ev.taskId ?? '',
                artifactHash: d.artifactSha256 ?? '',
                modelRunId: d.modelRunId ?? '',
                evidenceSetId: `EV-${ev.taskId ?? ''}-${d.evidenceCount ?? 0}`,
              },
            }))
            break
          case 'task.completed':
            setTask((prev) => ({
              ...prev,
              id: ev.taskId ?? prev?.id,
              status: d.status ?? 'completed',
              risk: d.risk ?? prev?.risk,
              evidenceCount: d.evidenceCount ?? prev?.evidenceCount,
              modelRunId: d.modelRunId,
            }))
            if (d.response) setResponse(d.response)
            break
          case 'task.failed':
            setTask((prev) => ({ ...prev, status: 'failed' }))
            setError(d.error ? String(d.error) : 'Task failed')
            if (d.response) setResponse(d.response)
            break
          default:
            break
        }
      }, controller.signal)
      setTask((prev) => ({ ...prev, status: prev?.status === 'failed' ? 'failed' : (prev?.status ?? 'completed') }))
      onRefreshOutputs()
      onRefreshSovereignty()
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Task failed')
      setTask((prev) => ({ ...prev, status: 'failed' }))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function handleSubmit(promptText: string, file?: File) {
    setPromptState(promptText)
    if (file) {
      setUploadedFiles((prev) => [...prev, { file, type: file.type.startsWith('image/') ? 'image' : 'pdf', ocrStatus: 'pending' }])
    }
    void runRealStream(promptText, file)
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
      />
    </div>
  )
}
