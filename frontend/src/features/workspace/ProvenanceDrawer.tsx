import { X, ArrowDown } from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { AgentStep, Artifact, EvidenceSource, Task, VerificationResult } from '../../lib/types'

interface ProvenanceDrawerProps {
  open: boolean
  onClose: () => void
  task: Partial<Task> | null
  steps: AgentStep[]
  sources: EvidenceSource[]
  artifacts: Artifact[]
  verification?: VerificationResult
  usedMock?: boolean
}

interface ProvenanceRow {
  label: string
  value: string
  sub?: string
  color?: string
}

export function ProvenanceDrawer({
  open,
  onClose,
  task,
  steps,
  sources,
  artifacts,
  verification,
  usedMock,
}: ProvenanceDrawerProps) {
  if (!open) return null

  const ocrStep = steps.find((s) => s.type === 'ocr')
  const routeStep = steps.find((s) => s.type === 'route')
  const modelStep = steps.find((s) => s.type === 'model')
  const toolSteps = steps.filter((s) => s.type === 'tool')
  const primaryArtifact = artifacts[0]

  const rows: ProvenanceRow[] = [
    {
      label: 'Request',
      value: task?.title ?? 'Task prompt',
      sub: `By ${task?.ownerName ?? 'engineer'} · ${task?.id ?? 'Not started'}`,
    },
    ...(ocrStep
      ? [{
          label: 'Extraction',
          value: 'Local OCR',
          sub: `${ocrStep.ocrResult?.pages ?? 0} pages · ${Math.round((ocrStep.ocrResult?.confidence ?? 0) * 100)}% confidence · 0 external calls`,
          color: 'text-signal',
        }]
      : []),
    ...(sources.length > 0
      ? [{
          label: 'Knowledge',
          value: sources.slice(0, 2).map((s) => s.title).join(', ') + (sources.length > 2 ? ` +${sources.length - 2} more` : ''),
          sub: `${sources.length} sources from organizational knowledge base`,
          color: 'text-signal',
        }]
      : []),
    ...(routeStep?.modelRoute
      ? [{
          label: 'Model',
          value: `${routeStep.modelRoute.selected.modelName}`,
          sub: `Locally hosted · Match score ${Math.round(routeStep.modelRoute.selected.score * 100)}%`,
          color: 'text-signal',
        }]
      : modelStep
      ? [{
          label: 'Model',
          value: modelStep.detail ?? 'Local model',
          sub: 'Locally hosted',
          color: 'text-signal',
        }]
      : []),
    ...(toolSteps.length > 0
      ? [{
          label: 'Tools',
          value: toolSteps.map((t) => t.toolRun?.toolName ?? t.label).join(', '),
          sub: 'All tools executed locally · Network blocked',
          color: 'text-signal',
        }]
      : []),
    ...(verification
      ? [{
          label: 'Verification',
          value: `${verification.checks.filter((c) => c.passed).length}/${verification.checks.length} checks passed`,
          sub: `Confidence ${Math.round(verification.confidence * 100)}%`,
          color: verification.passed ? 'text-signal' : 'text-danger',
        }]
      : []),
    {
      label: 'Network',
      value: '0 external connections',
      sub: 'Air-gapped execution · Zero egress',
      color: 'text-signal',
    },
    ...(primaryArtifact
      ? [{
          label: 'Output',
          value: primaryArtifact.filename,
          sub: primaryArtifact.sha256
            ? `SHA256: ${primaryArtifact.sha256.slice(0, 20)}…`
            : 'Generated locally',
          color: 'text-signal',
        }]
      : []),
    ...(task?.approval
      ? [{
          label: 'Approval',
          value: task.approval.approvedBy,
          sub: new Date(task.approval.approvedAt).toLocaleString('en-IN'),
          color: 'text-signal',
        }]
      : []),
    ...(primaryArtifact?.sha256
      ? [{
          label: 'Integrity',
          value: `SHA256: ${primaryArtifact.sha256.slice(0, 24)}…`,
          sub: 'Verified',
          color: 'text-signal',
        }]
      : []),
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-[340px] flex-col border-l border-line bg-navy shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-100">Task Provenance</div>
            <div className="mt-0.5 text-[10px] text-muted">Full lineage of this result</div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center text-muted hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <Icon icon={X} size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {usedMock && (
            <div className="mb-4 border border-warning/30 bg-warning/8 px-3 py-2 text-[9px] text-warning">
              Demo mode — mock execution data shown
            </div>
          )}

          <div className="space-y-0">
            {rows.map((row, i) => (
              <div key={i} className="relative">
                {/* Connector line */}
                {i < rows.length - 1 && (
                  <div className="absolute left-[11px] top-8 h-full w-0.5 bg-line/60" />
                )}

                <div className="relative flex items-start gap-3 py-2">
                  {/* Dot */}
                  <div className="mt-1.5 size-[10px] shrink-0 rounded-full border border-signal/60 bg-signal/20" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{row.label}</span>
                    </div>
                    <div className={`text-[11px] font-medium ${row.color ?? 'text-slate-200'} truncate`}>
                      {row.value}
                    </div>
                    {row.sub && (
                      <div className="text-[9px] text-muted leading-3.5">{row.sub}</div>
                    )}
                  </div>
                </div>

                {/* Arrow between items */}
                {i < rows.length - 1 && (
                  <div className="ml-[5px] text-slate-700">
                    <Icon icon={ArrowDown} size={8} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {rows.length === 0 && (
            <div className="py-12 text-center text-[11px] text-slate-600">
              Run a task to see its provenance
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-5 py-3">
          <div className="text-[9px] text-slate-600">
            All steps executed within sovereign execution boundary ·{' '}
            <span className="text-signal">Air-gapped</span>
          </div>
        </div>
      </div>
    </>
  )
}
