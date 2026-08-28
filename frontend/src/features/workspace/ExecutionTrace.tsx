import { useState, useEffect, useRef } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Database,
  FileText,
  Loader2,
  Network,
  Scan,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { AgentStep, ModelRoute, OcrResult, StepStatus, StepType, ToolRun } from '../../lib/types'

interface ExecutionTraceProps {
  steps: AgentStep[]
  loading: boolean
}

// ── Status icon ────────────────────────────────────────────────────────────────
function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <Icon icon={CheckCircle2} size={14} className="text-signal shrink-0" />
  if (status === 'running') return <Icon icon={Loader2} size={14} className="text-blue-400 animate-spin shrink-0" />
  if (status === 'failed') return <Icon icon={AlertCircle} size={14} className="text-danger shrink-0" />
  return <span className="size-3.5 rounded-full border border-slate-700 shrink-0" />
}

// ── Step type icon ─────────────────────────────────────────────────────────────
function StepTypeIcon({ type }: { type: StepType }) {
  const icons: Record<StepType, typeof Activity> = {
    plan: Activity,
    route: Network,
    model: Cpu,
    tool: Code2,
    knowledge: Database,
    ocr: Scan,
    verification: ShieldCheck,
    artifact: FileText,
    approval: CheckCircle2,
  }
  const ic = icons[type] || Activity
  return <Icon icon={ic} size={12} className="text-slate-500 shrink-0" />
}

// ── Model Routing Card ─────────────────────────────────────────────────────────
function ModelRoutingCard({ route }: { route: ModelRoute }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-line/60 bg-ink/30">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[10px] font-semibold text-slate-300">MODEL ROUTING</span>
        <Icon icon={open ? ChevronDown : ChevronRight} size={12} className="text-muted" />
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 pb-3 pt-2 space-y-2">
          <div className="text-[9px] text-muted mb-1">Task capabilities detected</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {route.detectedCapabilities.map((cap) => (
              <span key={cap} className="border border-signal/25 bg-signal/8 px-1.5 py-0.5 font-mono text-[8px] text-signal">
                ✓ {cap}
              </span>
            ))}
          </div>

          {/* Candidates */}
          <div className="space-y-1.5">
            {route.candidates.map((c) => (
              <div key={c.modelName} className="flex items-center gap-2">
                <span
                  className={`w-16 truncate font-mono text-[9px] ${
                    c.modelName === route.selected.modelName ? 'text-signal font-bold' : 'text-muted'
                  }`}
                >
                  {c.role.toUpperCase()}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-ink/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.modelName === route.selected.modelName ? 'bg-signal' : 'bg-slate-700'
                    }`}
                    style={{ width: `${Math.round(c.score * 100)}%` }}
                  />
                </div>
                <span className={`font-mono text-[9px] ${c.modelName === route.selected.modelName ? 'text-signal' : 'text-slate-600'}`}>
                  {Math.round(c.score * 100)}%
                </span>
              </div>
            ))}
          </div>

          {/* Selected */}
          <div className="mt-2 border border-signal/25 bg-signal/5 px-3 py-2">
            <div className="text-[8px] text-muted mb-0.5">Selected</div>
            <div className="text-[11px] font-bold text-signal">{route.selected.modelName}</div>
            <div className="text-[9px] text-muted">Match score: {Math.round(route.selected.score * 100)}%</div>
          </div>

          {route.laterStages && route.laterStages.length > 0 && (
            <div className="mt-1 text-[9px] text-slate-600">
              Later: {route.laterStages.map((s) => `${s.stage} → ${s.model}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tool Card ──────────────────────────────────────────────────────────────────
function ToolCard({ tool }: { tool: ToolRun }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-line/60 bg-ink/30">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Local Tool</span>
          <span className="text-[10px] font-semibold text-slate-300">{tool.toolName}</span>
        </div>
        <div className="flex items-center gap-2">
          {tool.status === 'completed' && <Icon icon={CheckCircle2} size={11} className="text-signal" />}
          <Icon icon={open ? ChevronDown : ChevronRight} size={12} className="text-muted" />
        </div>
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 pb-3 pt-2 space-y-1.5 font-mono text-[10px]">
          {tool.codeFile && (
            <div className="text-slate-500 mb-1.5">{tool.codeFile}</div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Status</span>
            <span className={tool.status === 'completed' ? 'text-signal' : 'text-warning'}>
              {tool.status === 'completed' ? '✓ Completed' : tool.status}
            </span>
          </div>
          {tool.durationMs && (
            <div className="flex justify-between">
              <span className="text-slate-600">Runtime</span>
              <span className="text-slate-300">{(tool.durationMs / 1000).toFixed(2)} sec</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Network</span>
            <span className="text-signal">BLOCKED</span>
          </div>
          {tool.exitCode !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-600">Exit code</span>
              <span className={tool.exitCode === 0 ? 'text-signal' : 'text-danger'}>{tool.exitCode}</span>
            </div>
          )}
          {tool.outputPreview && (
            <div className="mt-2 flex gap-2">
              <button className="border border-line px-2 py-1 text-[8px] text-muted hover:text-slate-200 transition-colors">
                View Code
              </button>
              <button className="border border-line px-2 py-1 text-[8px] text-muted hover:text-slate-200 transition-colors">
                View Output
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Knowledge Retrieval Card ───────────────────────────────────────────────────
function KnowledgeCard({ sources }: { sources: NonNullable<AgentStep['sources']> }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-line/60 bg-ink/30">
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">Knowledge Retrieval</span>
          <span className="text-[10px] font-semibold text-slate-300">{sources.length} relevant sources</span>
        </div>
        <Icon icon={open ? ChevronDown : ChevronRight} size={12} className="text-muted" />
      </button>
      {open && (
        <div className="border-t border-line/40 px-3 pb-3 pt-2 space-y-1.5">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-ink/60 overflow-hidden">
                <div className="h-full rounded-full bg-signal/60" style={{ width: `${s.relevanceScore * 100}%` }} />
              </div>
              <span className="font-mono text-[9px] text-signal w-8 text-right shrink-0">
                {Math.round(s.relevanceScore * 100)}%
              </span>
              <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{s.title}</span>
            </div>
          ))}
          <button className="mt-1 text-[9px] text-signal hover:underline">
            [Inspect Sources]
          </button>
        </div>
      )}
    </div>
  )
}

// ── OCR Card ───────────────────────────────────────────────────────────────────
function OcrCard({ result }: { result: OcrResult }) {
  return (
    <div className="border border-line/60 bg-ink/30 px-3 py-2 font-mono text-[10px]">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[8px] uppercase tracking-wider text-slate-600">Local OCR</span>
        <Icon icon={CheckCircle2} size={10} className="text-signal" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex justify-between col-span-2">
          <span className="text-slate-600">Pages</span><span className="text-slate-300">{result.pages}</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-slate-600">Text blocks</span><span className="text-slate-300">{result.textBlocks}</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-slate-600">Tables</span><span className="text-slate-300">{result.tables}</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-slate-600">Confidence</span><span className="text-signal">{Math.round(result.confidence * 100)}%</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-slate-600">External calls</span><span className="text-signal">0</span>
        </div>
      </div>
    </div>
  )
}

// ── Single step row ────────────────────────────────────────────────────────────
function StepRow({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail =
    step.modelRoute || step.toolRun || step.sources?.length || step.ocrResult || step.verification

  return (
    <div className={`timeline-appear border-b border-line/30 last:border-0`}>
      {/* Step header */}
      <button
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-raised/10 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        <StepStatusIcon status={step.status} />
        <span className="font-mono text-[9px] text-slate-600 w-4 shrink-0">{step.stepIndex}</span>
        <StepTypeIcon type={step.type} />
        <span className={`flex-1 text-xs font-medium ${step.status === 'completed' ? 'text-slate-300' : step.status === 'pending' ? 'text-slate-600' : 'text-slate-200'}`}>
          {step.label}
        </span>
        {step.durationMs !== undefined && step.status === 'completed' && (
          <span className="font-mono text-[9px] text-slate-600 shrink-0">
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {step.detail && <span className="font-mono text-[9px] text-muted truncate max-w-[80px]">{step.detail}</span>}
        {hasDetail && (
          <Icon icon={expanded ? ChevronDown : ChevronRight} size={11} className="text-slate-700 shrink-0" />
        )}
      </button>

      {/* Expanded detail card */}
      {expanded && (
        <div className="px-3 pb-3">
          {step.modelRoute && <ModelRoutingCard route={step.modelRoute} />}
          {step.toolRun && <ToolCard tool={step.toolRun} />}
          {step.sources && step.sources.length > 0 && <KnowledgeCard sources={step.sources} />}
          {step.ocrResult && <OcrCard result={step.ocrResult} />}
          {step.verification && (
            <div className="border border-line/60 bg-ink/30 px-3 py-2 text-[10px]">
              <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600 mb-2">Verification</div>
              <div className="space-y-1">
                {step.verification.checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Icon icon={c.passed ? CheckCircle2 : AlertCircle} size={11} className={c.passed ? 'text-signal' : 'text-danger'} />
                    <span className="text-[10px] text-slate-300">{c.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-muted">Confidence</span>
                <div className="flex-1 h-1 rounded-full bg-ink/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-signal"
                    style={{ width: `${step.verification.confidence * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-signal">
                  {Math.round(step.verification.confidence * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Execution Trace ────────────────────────────────────────────────────────────
export function ExecutionTrace({ steps, loading }: ExecutionTraceProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  if (!loading && steps.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Icon icon={Zap} size={32} className="text-slate-700" />
        <p className="text-xs text-slate-600">Execution trace will appear here when you run a task</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Task Execution</div>
          {loading && (
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-[8px] text-signal">RUNNING</span>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-line/20">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Icon icon={Loader2} size={12} className="text-blue-400 animate-spin" />
          <span className="font-mono text-[10px] text-muted">Processing...</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

// ── Agent Console (center panel) ───────────────────────────────────────────────
type ConsoleMode = 'conversation' | 'execution' | 'summary'

interface AgentConsoleProps {
  steps: AgentStep[]
  loading: boolean
  response: string
  prompt: string
  children?: React.ReactNode // for TaskComposer slot
}

export function AgentConsole({ steps, loading, response, prompt, children }: AgentConsoleProps) {
  const [mode, setMode] = useState<ConsoleMode>('execution')
  const MODES: { id: ConsoleMode; label: string }[] = [
    { id: 'conversation', label: 'Conversation' },
    { id: 'execution', label: 'Execution' },
    { id: 'summary', label: 'Summary' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Mode switcher */}
      <div className="flex shrink-0 border-b border-line bg-ink/20">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-2.5 text-[9px] font-mono uppercase tracking-[0.12em] transition-colors ${
              mode === m.id
                ? 'border-b-2 border-signal text-signal bg-signal/5'
                : 'text-muted hover:text-slate-300'
            }`}
          >
            {m.label}
          </button>
        ))}
        {loading && (
          <div className="ml-auto flex items-center gap-1.5 pr-4">
            <Icon icon={Loader2} size={11} className="text-blue-400 animate-spin" />
            <span className="font-mono text-[8px] text-blue-400">RUNNING</span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === 'conversation' && (
          <div className="p-4 space-y-4">
            {prompt && (
              <div className="flex gap-3">
                <div className="size-7 shrink-0 flex items-center justify-center border border-line bg-panel font-mono text-[8px] text-muted">
                  YOU
                </div>
                <div className="flex-1 border border-line bg-panel/60 px-3 py-2.5 text-xs text-slate-200">
                  {prompt}
                </div>
              </div>
            )}
            {response && (
              <div className="flex gap-3">
                <div className="size-7 shrink-0 flex items-center justify-center border border-signal/30 bg-signal/8 font-mono text-[8px] text-signal">
                  AI
                </div>
                <div className="flex-1 border border-signal/20 bg-signal/5 px-3 py-2.5 text-xs leading-5 text-slate-200">
                  {response}
                </div>
              </div>
            )}
            {!prompt && !response && (
              <div className="flex h-40 items-center justify-center text-[11px] text-slate-600">
                Start a conversation with AntarAI…
              </div>
            )}
          </div>
        )}

        {mode === 'execution' && (
          <ExecutionTrace steps={steps} loading={loading} />
        )}

        {mode === 'summary' && (
          <div className="p-4">
            {response ? (
              <div className="prose-sm text-xs leading-5 text-slate-200 space-y-3">
                <div className="border-l-2 border-signal/50 pl-3 text-sm font-medium text-slate-100">
                  Task Complete
                </div>
                <p className="text-muted leading-5">{response}</p>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-[11px] text-slate-600">
                Summary will appear after task completes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer slot */}
      {children && (
        <div className="shrink-0 border-t border-line">
          {children}
        </div>
      )}
    </div>
  )
}
