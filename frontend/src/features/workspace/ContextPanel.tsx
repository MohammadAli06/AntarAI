import { useState } from 'react'
import { Book, FileText, Grid, Info, X } from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { AgentStep, EvidenceSource, RiskLevel, Task, UploadedFile } from '../../lib/types'

interface ContextPanelProps {
  task: Partial<Task> | null
  uploadedFiles: UploadedFile[]
  sources: EvidenceSource[]
  steps: AgentStep[]
  risk: RiskLevel
  onRemoveFile: (index: number) => void
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

export function ContextPanel({ task, uploadedFiles, sources, steps: _steps, risk, onRemoveFile }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('files')

  return (
    <div className="flex h-full flex-col border-r border-line bg-navy/60">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-line bg-ink/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[9px] font-mono uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-signal text-signal bg-signal/5'
                : 'text-muted hover:text-slate-300'
            }`}
          >
            <Icon icon={tab.icon} size={11} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* FILES tab */}
        {activeTab === 'files' && (
          <div className="space-y-2">
            {uploadedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Icon icon={FileText} size={28} className="text-slate-700" />
                <p className="text-[10px] text-slate-600">No files attached</p>
                <p className="text-[9px] text-slate-700">Files will appear here when you attach them</p>
              </div>
            ) : (
              uploadedFiles.map((f, i) => (
                <div key={i} className="group flex items-start gap-2.5 border border-line bg-panel/60 p-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center border border-line bg-ink/35 text-signal">
                    <Icon icon={FileText} size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-slate-200">{f.file.name}</div>
                    <div className="mt-0.5 text-[9px] text-muted">
                      {f.type.toUpperCase()}
                      {f.ocrStatus === 'complete' && (
                        <span className="ml-1.5 text-signal">· OCR ✓</span>
                      )}
                      {f.visionStatus === 'complete' && (
                        <span className="ml-1.5 text-signal">· Vision ✓</span>
                      )}
                      {f.pageCount !== undefined && (
                        <span className="ml-1.5 text-slate-600">{f.pageCount} pages</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveFile(i)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition"
                    aria-label="Remove file"
                  >
                    <Icon icon={X} size={12} />
                  </button>
                </div>
              ))
            )}

            {/* Demo: static files for demo flow */}
            {uploadedFiles.length === 0 && (
              <div className="mt-4 space-y-2 opacity-40">
                {[
                  { name: 'inspection-report.pdf', detail: '14 pages · OCR ready', icon: '📄' },
                  { name: 'pump-P201.jpg', detail: 'Vision analysis ready', icon: '🖼' },
                  { name: 'calculation.xlsx', detail: '3 sheets', icon: '📊' },
                ].map((f) => (
                  <div key={f.name} className="flex items-center gap-2.5 border border-line/50 bg-panel/30 p-2.5">
                    <span className="text-base">{f.icon}</span>
                    <div>
                      <div className="text-[10px] font-medium text-slate-400">{f.name}</div>
                      <div className="text-[9px] text-slate-600">{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KNOWLEDGE tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-2">
            {sources.length === 0 ? (
              <div className="py-10 text-center text-[10px] text-slate-600">
                Knowledge sources will appear after retrieval
              </div>
            ) : (
              sources.map((src) => (
                <div key={src.id} className="border border-line bg-panel/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-slate-200">{src.title}</div>
                      {src.section && (
                        <div className="mt-0.5 text-[9px] text-muted">{src.section}</div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <div className="font-mono text-[10px] text-signal">
                        {Math.round(src.relevanceScore * 100)}%
                      </div>
                    </div>
                  </div>
                  {/* Relevance bar */}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/60">
                    <div
                      className="h-full rounded-full bg-signal/70"
                      style={{ width: `${src.relevanceScore * 100}%` }}
                    />
                  </div>
                  {src.excerpt && (
                    <p className="mt-2 text-[9px] leading-3.5 text-slate-600 line-clamp-3">
                      {src.excerpt}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TASK tab */}
        {activeTab === 'task' && (
          <div className="space-y-3">
            <div className="border border-line bg-panel/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted">Risk Level</span>
                <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase ${RISK_COLORS[risk]}`}>
                  {risk}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted">Owner</span>
                <span className="font-mono text-[10px] text-slate-300">{task?.ownerName ?? 'engineer1'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted">Evidence</span>
                <span className="font-mono text-[10px] text-slate-300">{sources.length} sources</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted">Requires Approval</span>
                <span className={`font-mono text-[10px] ${risk === 'high' || risk === 'critical' ? 'text-warning' : 'text-signal'}`}>
                  {risk === 'high' || risk === 'critical' ? 'YES' : 'NO'}
                </span>
              </div>
            </div>

            {task?.workflowTemplate && (
              <div className="border border-line bg-panel/60 p-3">
                <div className="text-[9px] font-mono uppercase tracking-wider text-muted mb-2">Workflow</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{task.workflowTemplate.icon}</span>
                  <div>
                    <div className="text-[11px] font-medium text-slate-200">{task.workflowTemplate.title}</div>
                    <div className="text-[9px] text-muted">{task.workflowTemplate.expectedDeliverable}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METADATA tab */}
        {activeTab === 'metadata' && (
          <div className="space-y-2 font-mono text-[10px]">
            {[
              { label: 'Task ID', value: task?.id ?? 'Not started' },
              { label: 'Status', value: task?.status ?? 'Draft' },
              { label: 'Created', value: task?.createdAt ? new Date(task.createdAt).toLocaleTimeString('en-IN') : '—' },
              { label: 'Updated', value: task?.updatedAt ? new Date(task.updatedAt).toLocaleTimeString('en-IN') : '—' },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 border border-line/50 bg-panel/30 px-3 py-2">
                <span className="text-[8px] uppercase tracking-wider text-slate-600">{row.label}</span>
                <span className="text-signal">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
