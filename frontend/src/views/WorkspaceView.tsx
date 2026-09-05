import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, Play } from 'lucide-react'
import { fetchConversation, streamChat } from '../lib/api'
import { getUser } from '../lib/auth'
import { Icon } from '../components/ui/Icon'
import type {
  AgentStep,
  Artifact,
  ConversationMessage,
  EvidenceSource,
  RiskLevel,
  SovereigntyStatus,
  StepStatus,
  StepType,
  Task,
  UploadedFile,
  VerificationResult,
  WorkflowTemplate,
  ViewId,
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
  onNavigate: (view: ViewId) => void
  activeConversationId?: number | null
  onConversationChange?: (id: number | null) => void
  onConversationsRefresh?: () => void
}

// Backend stream event (loosely typed — the reducer switches on `type`).
interface StreamEvent {
  type: string
  taskId?: string
  stepId?: string
  timestamp?: string
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
  sovereignty,
  onRefreshSovereignty,
  activeTemplate,
  onNavigate,
  activeConversationId,
  onConversationChange,
  onConversationsRefresh,
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
  const [task, setTask] = useState<Partial<Task> | null>(null)
  const [provenanceOpen, setProvenanceOpen] = useState(false)
  const [historyMessages, setHistoryMessages] = useState<ConversationMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (activeTemplate) setPromptState(activeTemplate.defaultPrompt)
  }, [activeTemplate])

  useEffect(() => {
    if (activeConversationId == null) {
      setHistoryMessages([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    fetchConversation(activeConversationId)
      .then((detail) => {
        if (cancelled) return
        setHistoryMessages(detail.messages)
        const lastAi = [...detail.messages].reverse().find((m) => m.role === 'assistant')
        if (lastAi) setResponse(lastAi.content)
        else setResponse('')
      })
      .catch(() => {
        if (!cancelled) setHistoryMessages([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [activeConversationId])

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

  // Real streaming task via /chat/stream (SSE). Conversation-scoped: the prior
  // thread (including file names) is threaded into the model prompt server-side
  // so "what about the left side?" sees the same pump image.
  async function runRealStream(promptText: string, file?: File) {
    setLoading(true)
    setError('')
    setSteps([])
    setSources([])
    setArtifacts([])
    setVerification(undefined)
    setResponse('')
    const now = new Date().toISOString()
    setTask({
      id: 'TASK-…',
      title: promptText.slice(0, 80) || 'Untitled task',
      description: promptText,
      ownerId: user?.username ?? 'engineer1',
      ownerName: user?.username ?? 'engineer1',
      status: 'running',
      risk: 'high',
      createdAt: now,
      updatedAt: now,
      workflowTemplate: activeTemplate ?? undefined,
      inputs: [],
      plan: [],
      modelRoutes: [],
      sources: [],
      toolRuns: [],
      artifacts: [],
      requiresApproval: false,
    })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat(promptText, file, (raw) => {
        const ev = raw as unknown as StreamEvent & { conversationId?: number }
        if (ev.conversationId != null && onConversationChange) {
          onConversationChange(ev.conversationId)
        }
        const sid = ev.stepId
        const d = ev.data ?? {}

        switch (ev.type) {
          case 'task.created':
            setTask((prev) => ({
              ...prev,
              id: ev.taskId ?? prev?.id,
              updatedAt: new Date().toISOString(),
            }))
            break
          case 'plan.created':
            setTask((prev) => ({ ...prev, status: 'planning', updatedAt: ev.timestamp ?? new Date().toISOString() }))
            upsertStep('plan', 'completed', { completedAt: ev.timestamp, detail: 'Execution plan created' })
            break
          case 'router.started':
            upsertStep('route', 'running')
            setTask((prev) => ({ ...prev, status: 'running', updatedAt: ev.timestamp ?? new Date().toISOString() }))
            break
          case 'router.completed': {
            const riskVal = (d.risk as RiskLevel | undefined) ?? 'high'
            setTask((prev) => ({
              ...prev,
              risk: riskVal,
              modelRunId: d.endpoint ? `${d.model}@${d.endpoint}` : prev?.modelRunId,
              updatedAt: new Date().toISOString(),
            }))
            upsertStep('route', 'completed', { modelRoute: d.modelRoute as any, detail: d.routeReason as string | undefined })
            break
          }
          case 'ocr.started':
            upsertStep('ocr', 'running')
            // mark attached files as processing
            setUploadedFiles((prev) => prev.map((f) => ({ ...f, ocrStatus: 'processing' as const })))
            break
          case 'ocr.completed': {
            const ok = Boolean((d.ocrResult as any)?.succeeded)
            upsertStep('ocr', ok ? 'completed' : 'failed', { ocrResult: d.ocrResult as any, error: ok ? undefined : String(d.reason || 'Extraction failed') })
            setUploadedFiles((prev) => prev.map((f) => ({ ...f, ocrStatus: ok ? 'complete' as const : 'failed' as const, visionStatus: f.type === 'image' ? (ok ? 'complete' as const : 'failed' as const) : f.visionStatus, pageCount: (d.ocrResult as any)?.pages || undefined, sheetCount: (d.ocrResult as any)?.sheets || undefined })))
            break
          }
          case 'knowledge.started':
            upsertStep('knowledge', 'running')
            break
          case 'knowledge.completed': {
            const srcs = (d.sources as EvidenceSource[] | undefined) ?? []
            upsertStep('knowledge', 'completed', { sources: srcs as any })
            setSources(srcs)
            setTask((prev) => ({ ...prev, evidenceCount: srcs.length, updatedAt: new Date().toISOString() }))
            break
          }
          case 'model.started':
            upsertStep('model', 'running', { detail: (d.model as string | undefined) ?? (d.role as string | undefined) })
            break
          case 'model.completed':
            upsertStep('model', 'completed', { detail: (d.detail as string | undefined) })
            if (d.response) setResponse(d.response as string)
            break
          case 'model.failed':
            upsertStep('model', 'failed', { error: d.error as string | undefined })
            break
          case 'tool.started':
            if (sid) upsertStep(sid, 'running')
            break
          case 'tool.completed':
            if (sid) upsertStep(sid, 'completed', { toolRun: d.toolRun as any })
            break
          case 'tool.failed':
            if (sid) upsertStep(sid, 'failed', { error: (d.error as string | undefined) ?? (d.toolRun as any)?.error })
            break
          case 'verification.started':
            upsertStep('verification', 'running')
            setTask((prev) => ({ ...prev, status: 'verifying', updatedAt: new Date().toISOString() }))
            break
          case 'verification.completed': {
            const v = d.verification as VerificationResult | undefined
            upsertStep('verification', 'completed', { verification: v as any })
            if (v) setVerification(v)
            break
          }
          case 'artifact.created': {
            const art = d.artifact as Artifact | undefined
            if (art) setArtifacts((prev) => [...prev, art])
            upsertStep('artifact', art ? 'completed' : 'failed', { artifact: art, completedAt: ev.timestamp })
            break
          }
          case 'approval.required':
            setTask((prev) => ({
              ...prev,
              status: 'pending_approval',
              risk: (d.risk as RiskLevel | undefined) ?? prev?.risk ?? 'high',
              evidenceCount: (d.evidenceCount as number | undefined) ?? prev?.evidenceCount,
              modelRunId: (d.modelRunId as string | undefined) ?? prev?.modelRunId,
              updatedAt: new Date().toISOString(),
            }))
            upsertStep('approval', 'pending', { detail: 'Supervisor approval required' })
            break
          case 'approval.approved':
            setTask((prev) => ({
              ...prev,
              status: 'approved',
              approval: {
                approvedBy: (d.approvedBy as string | undefined) ?? 'Supervisor',
                approvedAt: new Date().toISOString(),
                taskId: (ev.taskId as string | undefined) ?? '',
                artifactHash: (d.artifactSha256 as string | undefined) ?? '',
                modelRunId: (d.modelRunId as string | undefined) ?? '',
                evidenceSetId: `EV-${(ev.taskId as string | undefined) ?? ''}-${(d.evidenceCount as number | undefined) ?? 0}`,
              },
              updatedAt: new Date().toISOString(),
            }))
            break
          case 'task.completed': {
            const status = (d.status as string | undefined) ?? 'completed'
            setTask((prev) => ({
              ...prev,
              id: (ev.taskId as string | undefined) ?? prev?.id,
              status: status as any,
              risk: (d.risk as RiskLevel | undefined) ?? prev?.risk,
              evidenceCount: (d.evidenceCount as number | undefined) ?? prev?.evidenceCount,
              modelRunId: (d.modelRunId as string | undefined) ?? prev?.modelRunId,
              updatedAt: new Date().toISOString(),
            }))
            if (d.response) setResponse(d.response as string)
            // persist verification/artifact fields that arrive only on task.completed
            if (d.verification) setVerification(d.verification as VerificationResult)
            if (!d.generatedFile) upsertStep('artifact', 'skipped', { detail: 'No file artifact requested' })
            if (d.artifactSha256 && artifacts.length === 0) {
              // artifact already handled via artifact.created; keep hash on task
            }
            if (status !== 'pending_approval') upsertStep('approval', 'skipped', { detail: 'Auto-approved by policy' })
            break
          }
          case 'task.failed': {
            const failedStep = (d.stepId as string | undefined) ?? (d.failedStep as string | undefined)
            if (failedStep) upsertStep(failedStep, 'failed', { error: d.error as string | undefined })
            setTask((prev) => ({ ...prev, status: 'failed', updatedAt: new Date().toISOString() }))
            setError(d.error ? String(d.error) : 'Task failed')
            if (d.response) setResponse(d.response as string)
            break
          }
          default:
            break
        }
      }, controller.signal, activeConversationId ?? undefined)
      setTask((prev) => ({ ...prev, status: prev?.status === 'failed' ? 'failed' : (prev?.status ?? 'completed') }))
      onConversationsRefresh?.()
      if (activeConversationId != null) {
        fetchConversation(activeConversationId).then((detail) => setHistoryMessages(detail.messages)).catch(() => {})
      }
      onRefreshOutputs()
      onRefreshSovereignty()
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Task execution failed')
      setTask((prev) => ({ ...prev, status: 'failed' }))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(promptText: string, file?: File) {
    setPromptState(promptText)
    setUploadedFiles(file ? [{ file, type: file.type.startsWith('image/') ? 'image' : file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'document', ocrStatus: 'pending', visionStatus: file.type.startsWith('image/') ? 'pending' : undefined }] : [])
    void runRealStream(promptText, file)
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const isRunning = loading || task?.status === 'running' || task?.status === 'verifying'
  const isFailed = task?.status === 'failed'
  const isPendingApproval = task?.status === 'pending_approval'
  const isCompleted = task?.status === 'completed' || task?.status === 'approved'
  const riskLevel: RiskLevel = (task?.risk as RiskLevel | undefined) ?? 'high'
  const riskLabel = riskLevel.toUpperCase()
  const riskTone =
    riskLevel === 'critical' || riskLevel === 'high'
      ? 'border-danger/40 bg-danger/10 text-danger'
      : riskLevel === 'medium'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : 'border-signal/40 bg-signal/10 text-signal'
  const statusLabel = !task
    ? 'IDLE'
    : isFailed
      ? 'FAILED'
      : isPendingApproval
        ? 'PENDING APPROVAL'
        : isRunning
          ? 'RUNNING'
          : isCompleted
            ? 'COMPLETED'
            : String(task.status).toUpperCase()
  const progressPct = !task ? 0 : isFailed ? 100 : isPendingApproval ? 90 : isCompleted ? 100 : isRunning ? Math.min(95, Math.max(15, steps.filter((s) => s.status === 'completed').length * 12)) : 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ink text-slate-100">
      {/* ── Sub-header / Task Metadata Bar ─────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-panel/50 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="font-mono text-xs font-bold text-slate-100">
            # {task?.id || 'No task yet'}
          </span>
          {task && (
            <span className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${riskTone}`}>
              <span className={`size-1.5 rounded-full ${riskLevel === 'high' || riskLevel === 'critical' ? 'bg-danger' : riskLevel === 'medium' ? 'bg-warning' : 'bg-signal'}`} />
              {riskLabel} RISK
            </span>
          )}
          <span className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${isFailed ? 'border-danger/40 bg-danger/10 text-danger' : isPendingApproval ? 'border-warning/40 bg-warning/10 text-warning' : isRunning ? 'border-signal/40 bg-signal/10 text-signal' : 'border-line bg-panel text-muted'}`}>
            <Icon icon={isRunning ? Loader2 : isFailed ? AlertTriangle : CheckCircle2} size={10} className={isRunning ? 'animate-spin' : ''} />
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setProvenanceOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-signal transition-colors"
          >
            <Icon icon={HelpCircle} size={13} className="text-signal" />
            <span className="hidden sm:inline">Why should I trust this result?</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="underline font-mono text-[10px]">
            Dismiss
          </button>
        </div>
      )}

      {/* ── 3-panel workspace layout ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — Task Summary, Uploads, RAG */}
        <div className="hidden w-[240px] shrink-0 overflow-hidden border-r border-line bg-navy/60 lg:flex lg:flex-col xl:w-[260px]">
          <ContextPanel
            task={task}
            uploadedFiles={uploadedFiles}
            sources={sources}
            steps={steps}
            risk={riskLevel}
            onRemoveFile={removeFile}
            sovereignty={sovereignty}
            verification={verification}
            artifacts={artifacts}
            onOpenProvenance={() => setProvenanceOpen(true)}
            onOpenKnowledgeBase={() => onNavigate('knowledge-base')}
          />
        </div>

        {/* CENTER — Execution Trace / Console */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-ink">
          {activeConversationId != null && (
            <div className="flex max-h-[32vh] shrink-0 flex-col overflow-hidden border-b border-line bg-panel/30">
              <div className="flex items-center justify-between border-b border-line/60 bg-ink/20 px-3 py-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Thread — continue this conversation</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onConversationChange?.(null)}
                    className="rounded border border-line bg-panel px-2 py-1 font-mono text-[9px] text-muted hover:text-slate-200"
                  >
                    New thread
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {historyLoading ? (
                  <div className="py-4 text-center text-xs text-muted">Loading thread…</div>
                ) : historyMessages.length === 0 ? (
                  <div className="py-3 text-center text-[11px] text-slate-600">No prior turns in this conversation yet. Your next message will start the thread.</div>
                ) : (
                  historyMessages.slice(-10).map((m) => (
                    <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? '' : 'opacity-90'}`}>
                      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center border font-mono text-[8px] ${m.role === 'user' ? 'border-line bg-panel text-muted' : 'border-signal/30 bg-signal/10 text-signal'}`}>
                        {m.role === 'user' ? 'YOU' : 'AI'}
                      </span>
                      <div className={`flex-1 border px-2.5 py-2 text-xs leading-5 ${m.role === 'user' ? 'border-line bg-panel/60 text-slate-200' : 'border-signal/20 bg-signal/5 text-slate-200'}`}>
                        <div className="whitespace-pre-wrap break-words">{m.content || '—'}</div>
                        {m.attachments.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.attachments.map((a) => (
                              <span key={a.id} className="rounded border border-line bg-ink/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">{a.filename}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <AgentConsole
            steps={steps}
            loading={loading}
            response={response}
            prompt={prompt}
            task={task}
            sources={sources}
            artifacts={artifacts}
            verification={verification}
            onOpenApprovals={() => onNavigate('approvals')}
            conversationId={activeConversationId ?? undefined}
            onNewThread={() => onConversationChange?.(null)}
          >
            <TaskComposer
              onSubmit={handleSubmit}
              loading={loading}
              initialPrompt={activeTemplate?.defaultPrompt ?? ''}
              template={activeTemplate}
              onOpenTemplates={() => onNavigate('home')}
            />
          </AgentConsole>
        </div>

        {/* RIGHT — Live Preview, Verification, Deliverables */}
        <div className="hidden w-[250px] shrink-0 overflow-hidden border-l border-line bg-navy/40 xl:flex xl:flex-col xl:w-[280px]">
          <ArtifactPanel
            response={response}
            sources={sources}
            artifacts={artifacts}
            verification={verification}
            loading={loading}
            taskStatus={task?.status}
          />
        </div>
      </div>

      {/* ── Bottom Progress Bar ─────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-line bg-panel/70 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3 w-full max-w-sm">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 shrink-0">
            EXECUTION PROGRESS {progressPct}%
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/80">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isFailed ? 'bg-danger' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 font-mono text-[9px] text-slate-500">
          <span>{sovereignty?.externalCalls === 0 ? 'AIR-GAPPED SYSTEM' : 'SOVEREIGNTY STATUS'}</span>
          <span className="text-slate-700">·</span>
          <span className={sovereignty?.externalCalls === 0 ? 'text-signal' : 'text-warning'}>{sovereignty?.externalCalls ?? '—'} EGRESS</span>
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
        sovereignty={sovereignty}
      />
    </div>
  )
}
