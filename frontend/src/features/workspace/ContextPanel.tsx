import { useState } from 'react'
import { Book, FileText, Grid, Info, X, ShieldCheck, Cpu, Database, FileCheck, Clock, User, Hash, ExternalLink, Eye, Download } from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { AgentStep, Artifact, EvidenceSource, RiskLevel, SovereigntyStatus, Task, VerificationResult } from '../../lib/types'

interface ContextPanelProps {
  task: Partial<Task> | null
  uploadedFiles: import('../../lib/types').UploadedFile[]
  sources: EvidenceSource[]
  steps: AgentStep[]
  risk: RiskLevel
  onRemoveFile: (index: number) => void
  sovereignty?: SovereigntyStatus | null
  verification?: VerificationResult
  artifacts?: Artifact[]
  onOpenProvenance?: () => void
  onOpenKnowledgeBase?: () => void
}

type Tab = 'files' | 'knowledge' | 'task' | 'metadata'

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'knowledge', label: 'Knowledge', icon: Book },
  { id: 'task', label: 'Task', icon: Grid },
  { id: 'metadata', label: 'Info', icon: Info },
]

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'border-signal/30 bg-signal/8 text-signal',
  medium: 'border-warning/30 bg-warning/8 text-warning',
  high: 'border-danger/30 bg-danger/8 text-danger',
  critical: 'border-danger bg-danger/20 text-danger',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

export function ContextPanel({ task, uploadedFiles, sources, steps, risk, onRemoveFile, sovereignty, verification, artifacts, onOpenProvenance, onOpenKnowledgeBase }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('files')
  const [inspectedSource, setInspectedSource] = useState<string | null>(null)
  const routeStep = steps.find((s) => s.type === 'route')
  const ocrStep = steps.find((s) => s.type === 'ocr')
  const modelStep = steps.find((s) => s.type === 'model')
  const primaryArtifact = artifacts?.[0]
  const workflowSteps: { label: string; status: string }[] = [
    { label: 'Planning', status: steps.find((s) => s.id === 'plan')?.status ?? 'pending' },
    { label: 'Model Selection', status: routeStep?.status ?? 'pending' },
    { label: 'OCR', status: ocrStep ? ocrStep.status : uploadedFiles.length > 0 ? 'pending' : 'skipped' },
    { label: 'Knowledge Retrieval', status: steps.find((s) => s.type === 'knowledge')?.status ?? 'pending' },
    { label: 'Reasoning', status: modelStep?.status ?? 'pending' },
    { label: 'Verification', status: steps.find((s) => s.type === 'verification')?.status ?? 'pending' },
    { label: 'Artifact', status: steps.find((s) => s.type === 'artifact')?.status ?? (primaryArtifact ? 'completed' : 'pending') },
    { label: 'Approval', status: steps.find((s) => s.type === 'approval')?.status ?? 'pending' },
  ]

  function openLocalFile(file: File) {
    const url = URL.createObjectURL(file)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  function downloadLocalFile(file: File) {
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col border-r border-line bg-navy/60">
      <div className="flex shrink-0 border-b border-line bg-ink/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[9px] font-mono uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab.id ? 'border-b-2 border-signal text-signal bg-signal/5' : 'text-muted hover:text-slate-300'
            }`}
          >
            <Icon icon={tab.icon} size={11} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted">Input Context</span>
              <span className="font-mono text-[9px] text-slate-500">{uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}</span>
            </div>
            {uploadedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center border border-dashed border-line/60 bg-panel/20">
                <Icon icon={FileText} size={28} className="text-slate-700" />
                <p className="text-[10px] text-slate-600">No files attached</p>
                <p className="text-[9px] text-slate-700">Attach a PDF, image, or spreadsheet to give the agent context</p>
              </div>
            ) : (
              uploadedFiles.map((f, i) => {
                const ext = f.file.name.split('.').pop()?.toLowerCase() ?? ''
                const isImage = f.type === 'image' || ['png','jpg','jpeg','webp','gif','bmp','tiff'].includes(ext)
                const isPdf = ext === 'pdf'
                const kind = isImage ? 'Vision' : isPdf ? 'PDF' : 'Document'
                return (
                  <div key={i} className="group border border-line bg-panel/60 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-line bg-ink/35 text-signal">
                        <Icon icon={FileText} size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-slate-200" title={f.file.name}>{f.file.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-muted">
                          <span>{kind}</span>
                          <span className="text-slate-700">·</span>
                          <span>{formatBytes(f.file.size)}</span>
                          {f.pageCount !== undefined && <><span className="text-slate-700">·</span><span>{f.pageCount} pages</span></>}
                          {f.sheetCount !== undefined && <><span className="text-slate-700">·</span><span>{f.sheetCount} sheets</span></>}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {f.ocrStatus === 'processing' && <span className="border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[8px] text-signal">OCR running…</span>}
                          {f.ocrStatus === 'complete' && <span className="border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[8px] text-signal">OCR ✓</span>}
                          {f.ocrStatus === 'failed' && <span className="border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[8px] text-danger">Extraction failed</span>}
                          {f.visionStatus === 'complete' && <span className="border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[8px] text-signal">Vision ✓</span>}
                          {f.ocrStatus === 'pending' && uploadedFiles.length > 0 && <span className="border border-line bg-ink/40 px-1.5 py-0.5 font-mono text-[8px] text-muted">OCR pending</span>}
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          <button onClick={() => openLocalFile(f.file)} className="flex items-center gap-1 border border-line px-1.5 py-0.5 text-[8px] text-muted hover:text-signal"><Icon icon={Eye} size={9} />Preview</button>
                          <button onClick={() => downloadLocalFile(f.file)} className="flex items-center gap-1 border border-line px-1.5 py-0.5 text-[8px] text-muted hover:text-signal"><Icon icon={Download} size={9} />Download</button>
                        </div>
                      </div>
                      <button onClick={() => onRemoveFile(i)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition" aria-label="Remove file">
                        <Icon icon={X} size={12} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
            {uploadedFiles.length > 0 && ocrStep?.ocrResult && (
              <div className="border border-line/60 bg-ink/30 px-3 py-2 font-mono text-[9px]">
                <div className="text-[8px] uppercase tracking-wider text-slate-600 mb-1">Extraction</div>
                {ocrStep.ocrResult.pages > 0 && <div className="flex justify-between"><span className="text-slate-600">Pages</span><span className="text-slate-300">{ocrStep.ocrResult.pages}</span></div>}
                {(ocrStep.ocrResult.sheets ?? 0) > 0 && <div className="flex justify-between"><span className="text-slate-600">Sheets</span><span className="text-slate-300">{ocrStep.ocrResult.sheets}</span></div>}
                <div className="flex justify-between"><span className="text-slate-600">Text blocks</span><span className="text-slate-300">{ocrStep.ocrResult.textBlocks}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Extraction</span><span className={ocrStep.ocrResult.succeeded ? 'text-signal' : 'text-danger'}>{ocrStep.ocrResult.succeeded ? 'Succeeded' : 'Failed'}</span></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted">What the agent used</span>
              <span className="font-mono text-[9px] text-slate-500">{sources.length} source{sources.length !== 1 ? 's' : ''} retrieved</span>
            </div>
            {sources.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-line/60 bg-panel/20">
                <Icon icon={Database} size={20} className="mx-auto text-slate-700 mb-2" />
                <p className="text-[10px] text-slate-600">No knowledge retrieved yet</p>
                <p className="text-[9px] text-slate-700 mt-1">Run a task to see which organizational knowledge was actually used</p>
              </div>
            ) : (
              sources.map((src) => (
                <div key={src.id} className="border border-line bg-panel/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-slate-200 truncate" title={src.title}>{src.title}</div>
                      {src.section && <div className="mt-0.5 text-[9px] text-muted">{src.section}{src.page ? ` · Page ${src.page}` : ''}</div>}
                    </div>
                    <div className="shrink-0 font-mono text-[10px] text-signal">{Math.round(src.relevanceScore * 100)}%</div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/60">
                    <div className="h-full rounded-full bg-signal/70" style={{ width: `${src.relevanceScore * 100}%` }} />
                  </div>
                  {src.excerpt && <p className="mt-2 text-[9px] leading-3.5 text-slate-500 line-clamp-3">{src.excerpt}</p>}
                  <div className="mt-2 flex items-center gap-2 font-mono text-[8px] text-slate-600">
                    <span className="border border-line px-1.5 py-0.5">{src.sourceType}</span>
                    <span className="truncate">{src.id}</span>
                  </div>
                  <button onClick={() => setInspectedSource(inspectedSource === src.id ? null : src.id)} className="mt-2 text-[9px] text-signal hover:underline">
                    {inspectedSource === src.id ? 'Close source details' : 'Inspect source'}
                  </button>
                  {inspectedSource === src.id && <div className="mt-2 border-t border-line/40 pt-2 text-[9px] leading-4 text-slate-400 whitespace-pre-wrap">{src.excerpt || 'No excerpt was returned for this source.'}</div>}
                </div>
              ))
            )}
            <div className="pt-2 border-t border-line/40">
              <button onClick={onOpenKnowledgeBase} className="flex items-center gap-1 text-[9px] text-signal hover:underline">
                <Icon icon={ExternalLink} size={10} /> View Knowledge Base
              </button>
            </div>
          </div>
        )}

        {activeTab === 'task' && (
          <div className="space-y-3">
            {!task ? (
              <div className="py-10 text-center border border-dashed border-line/60 bg-panel/20">
                <Icon icon={Grid} size={20} className="mx-auto text-slate-700 mb-2" />
                <p className="text-[10px] text-slate-600">No active task</p>
                <p className="text-[9px] text-slate-700 mt-1">Submit a prompt to create a task</p>
              </div>
            ) : (
              <>
                <div className="border border-line bg-panel/60 p-3 space-y-2.5">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-muted">Task</div>
                  <div className="text-[11px] font-semibold text-slate-100 line-clamp-2">{task.title ?? task.id}</div>
                  {task.description && task.description !== task.title && (
                    <p className="text-[9px] leading-3.5 text-slate-500 line-clamp-3">{task.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/40 font-mono text-[9px]">
                    <div className="space-y-1">
                      <div className="text-[8px] uppercase tracking-wider text-slate-600">Task ID</div>
                      <div className="text-slate-300">{task.id}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] uppercase tracking-wider text-slate-600">Status</div>
                      <div className="text-signal uppercase">{task.status}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] uppercase tracking-wider text-slate-600">Owner</div>
                      <div className="flex items-center gap-1 text-slate-300"><Icon icon={User} size={10} />{task.ownerName ?? '—'}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] uppercase tracking-wider text-slate-600">Risk</div>
                      <span className={`inline-flex border px-1.5 py-0.5 text-[8px] uppercase ${RISK_COLORS[risk]}`}>{risk}</span>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <div className="text-[8px] uppercase tracking-wider text-slate-600">Created</div>
                      <div className="flex items-center gap-1 text-slate-400"><Icon icon={Clock} size={10} />{formatTime(task.createdAt)}</div>
                    </div>
                  </div>
                </div>

                <div className="border border-line bg-panel/60 p-3">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-muted mb-2">Workflow</div>
                  <div className="space-y-1.5">
                    {workflowSteps.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 font-mono text-[9px]">
                        <span className={`size-1.5 rounded-full shrink-0 ${s.status === 'completed' ? 'bg-signal' : s.status === 'running' ? 'bg-signal animate-pulse' : s.status === 'failed' ? 'bg-danger' : s.status === 'skipped' ? 'bg-slate-700' : 'border border-slate-700'}`} />
                        <span className={s.status === 'completed' ? 'text-slate-300' : s.status === 'running' ? 'text-signal' : 'text-slate-600'}>{s.label}</span>
                        <span className="ml-auto text-[8px] uppercase text-slate-600">{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {task.workflowTemplate && (
                  <div className="border border-line bg-panel/60 p-3">
                    <div className="text-[9px] font-mono uppercase tracking-wider text-muted mb-2">Template</div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{task.workflowTemplate.icon}</span>
                      <div>
                        <div className="text-[11px] font-medium text-slate-200">{task.workflowTemplate.title}</div>
                        <div className="text-[9px] text-muted">{task.workflowTemplate.expectedDeliverable}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted">
              <Icon icon={ShieldCheck} size={12} className="text-signal" /> Why should I trust this result?
            </div>
            {!task ? (
              <div className="py-8 text-center border border-dashed border-line/60 bg-panel/20 text-[10px] text-slate-600">Run a task to see provenance</div>
            ) : (
              <div className="space-y-2 font-mono text-[10px]">
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600 flex items-center gap-1"><Icon icon={Cpu} size={10} /> Model</div>
                  <div className="text-signal truncate">{routeStep?.modelRoute?.selected.modelName ?? modelStep?.detail ?? 'Pending'}</div>
                  {routeStep?.modelRoute && <div className="text-[9px] text-muted">Score {Math.round(routeStep.modelRoute.selected.score * 100)}% · {routeStep.modelRoute.selected.role}</div>}
                  {routeStep?.detail && <div className="mt-1 text-[9px] text-muted">{routeStep.detail}</div>}
                </div>
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600 flex items-center gap-1"><Icon icon={Database} size={10} /> Knowledge</div>
                  <div className="text-signal">{sources.length} source{sources.length !== 1 ? 's' : ''} retrieved</div>
                  {sources.length > 0 && <div className="text-[9px] text-muted truncate">{sources.slice(0,2).map(s=>s.title).join(', ')}</div>}
                </div>
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600 flex items-center gap-1"><Icon icon={FileCheck} size={10} /> Verification</div>
                  {verification ? (
                    <>
                      <div className={verification.passed ? 'text-signal' : 'text-danger'}>{verification.checks.filter(c=>c.passed).length}/{verification.checks.length} checks passed</div>
                      <div className="text-[9px] text-muted">Verification score {Math.round(verification.confidence*100)}%</div>
                    </>
                  ) : <div className="text-muted">Pending</div>}
                </div>
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600 flex items-center gap-1"><Icon icon={Hash} size={10} /> Artifact</div>
                  {primaryArtifact ? (
                    <>
                      <div className="text-signal truncate">{primaryArtifact.filename}</div>
                      {primaryArtifact.sha256 && <div className="text-[8px] text-muted truncate">SHA-256 {primaryArtifact.sha256.slice(0,24)}…</div>}
                    </>
                  ) : <div className="text-muted">No artifact yet</div>}
                </div>
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600">Execution node</div>
                  <div className="text-signal truncate">{routeStep?.modelRoute?.selected.endpoint ?? task.modelRunId ?? 'Pending'}</div>
                  <div className="text-[9px] text-muted">{task.status === 'pending_approval' ? 'Supervisor approval required' : `Approval: ${task.status ?? 'pending'}`}</div>
                </div>
                <div className="border border-line/50 bg-panel/30 px-3 py-2">
                  <div className="text-[8px] uppercase tracking-wider text-slate-600">Security</div>
                  <div className="mt-1 space-y-1 text-[9px]">
                    <div className="flex items-center gap-1.5 text-signal"><span className="size-1 rounded-full bg-signal" /> Local model</div>
                    <div className="flex items-center gap-1.5 text-signal"><span className="size-1 rounded-full bg-signal" /> No external API</div>
                    <div className={`flex items-center gap-1.5 ${(sovereignty?.externalCalls ?? 0) === 0 ? 'text-signal' : 'text-warning'}`}><span className="size-1 rounded-full bg-current" /> Air-gapped check · {sovereignty?.externalCalls ?? 'unknown'} egress</div>
                  </div>
                </div>
                <button onClick={onOpenProvenance} className="w-full border border-signal/30 bg-signal/10 px-3 py-2 text-[9px] uppercase tracking-wider text-signal hover:bg-signal/15 transition-colors">View full provenance →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
