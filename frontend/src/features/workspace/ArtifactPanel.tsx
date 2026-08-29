import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import { MarkdownContent } from '../../components/ui/MarkdownContent'
import { downloadOutputFile, fetchArtifactPreview } from '../../lib/api'
import type { Artifact, EvidenceSource, VerificationResult } from '../../lib/types'

interface ArtifactPanelProps {
  response: string
  sources: EvidenceSource[]
  artifacts: Artifact[]
  verification?: VerificationResult
  loading: boolean
  taskStatus?: string
}

type Tab = 'result' | 'evidence' | 'artifacts' | 'verify'

const TABS: { id: Tab; label: string }[] = [
  { id: 'result', label: 'Result' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'verify', label: 'Verify' },
]

function fileTypeIcon(ft: string) {
  const icons: Record<string, string> = {
    docx: '📄', doc: '📄', xlsx: '📊', xls: '📊',
    pptx: '📊', pdf: '📕', py: '🐍', json: '📋',
  }
  return icons[ft] ?? '📁'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ArtifactPanel({ response, sources, artifacts, verification, loading, taskStatus }: ArtifactPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('result')
  const [artifactPreview, setArtifactPreview] = useState<{ filename: string; content: string } | null>(null)
  const [inspectedSource, setInspectedSource] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')

  async function previewArtifact(filename: string) {
    setPreviewError('')
    try {
      setArtifactPreview({ filename, content: await fetchArtifactPreview(filename) })
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Artifact preview failed')
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-line bg-navy/40">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-line bg-ink/20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center py-2.5 text-[9px] font-mono uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-signal text-signal bg-signal/5'
                : 'text-muted hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.id === 'artifacts' && artifacts.length > 0 && (
              <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-signal/20 font-mono text-[7px] text-signal">
                {artifacts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* RESULT tab — actual model/agent result, state-consistent */}
        {activeTab === 'result' && (
          <div>
            {loading && !response && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] text-muted">
                  <Icon icon={ShieldCheck} size={12} className="animate-pulse text-signal" />
                  Generating response…
                </div>
                <div className="space-y-2 animate-pulse">
                  {[100, 90, 75, 100, 60].map((w, i) => (
                    <div key={i} className="h-3 rounded bg-panel" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            )}
            {!loading && !response && taskStatus === 'failed' && (
              <div className="py-10 text-center text-[10px] text-danger">Task failed — see Execution for the failed step</div>
            )}
            {!loading && !response && taskStatus !== 'failed' && (
              <div className="flex h-40 items-center justify-center text-[10px] text-slate-600">
                Result will appear here after task completes
              </div>
            )}
            {response && (
              <MarkdownContent content={response} className="text-xs" />
            )}
          </div>
        )}

        {/* EVIDENCE tab — actual RAG sources used by current task */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            {sources.length === 0 && loading && (
              <div className="py-10 text-center text-[10px] text-muted">Retrieving knowledge…</div>
            )}
            {sources.length === 0 && !loading && (
              <div className="py-10 text-center text-[10px] text-slate-600">
                No evidence sources yet — run a task to retrieve grounding sources
              </div>
            )}
            {sources.map((src) => (
              <div key={src.id} className="border border-line bg-panel/50">
                {/* Finding label */}
                {src.excerpt && (
                  <div className="border-b border-line/50 px-3 py-2">
                    <div className="font-mono text-[7px] uppercase tracking-wider text-slate-600 mb-1">Finding</div>
                    <p className="text-[10px] leading-4 text-slate-200">{src.excerpt}</p>
                  </div>
                )}
                <div className="px-3 py-2">
                  <div className="font-mono text-[7px] uppercase tracking-wider text-muted mb-1">Source</div>
                  <div className="text-[10px] font-semibold text-signal">{src.title}</div>
                  {src.page && (
                    <div className="mt-0.5 text-[9px] text-muted">
                      Page {src.page}{src.section ? ` · ${src.section}` : ''}
                    </div>
                  )}
                  <button onClick={() => setInspectedSource(inspectedSource === src.id ? null : src.id)} className="mt-1.5 text-[9px] text-signal hover:underline">
                    [{inspectedSource === src.id ? 'Close Source' : 'Inspect Source'}]
                  </button>
                  {inspectedSource === src.id && <div className="mt-2 border-t border-line/40 pt-2 font-mono text-[8px] leading-4 text-slate-500"><div>Source ID: {src.id}</div><div>Type: {src.sourceType}</div><div>Relevance: {Math.round(src.relevanceScore * 100)}%</div></div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ARTIFACTS tab — actual files generated by backend, exact artifact */}
        {activeTab === 'artifacts' && (
          <div className="space-y-3">
            {artifacts.length === 0 && loading && (
              <div className="py-10 text-center text-[10px] text-muted">Waiting for artifact…</div>
            )}
            {artifacts.length === 0 && !loading && (
              <div className="py-10 text-center text-[10px] text-slate-600">
                Generated files will appear here — the file displayed is the exact verified artifact
              </div>
            )}
            {artifacts.map((art) => (
              <div key={art.id} className="border border-line bg-panel/60">
                <div className="flex items-start gap-3 p-3">
                  <span className="text-2xl shrink-0">{fileTypeIcon(art.fileType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-slate-100">{art.filename}</div>
                    <div className="mt-0.5 text-[9px] text-muted">{formatBytes(art.sizeBytes)}</div>
                    {art.generatedLocally && (
                      <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-signal">
                        <Icon icon={CheckCircle2} size={9} />
                        Generated locally
                      </div>
                    )}
                    {art.sha256 && (
                      <div className="mt-0.5 font-mono text-[8px] text-slate-600 truncate">
                        SHA256: {art.sha256.slice(0, 16)}…
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 border-t border-line/50 px-3 py-2">
                  <button onClick={() => void previewArtifact(art.filename)} className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[9px] text-muted hover:border-signal/40 hover:text-signal transition-colors">
                    <Icon icon={Eye} size={11} />
                    Preview
                  </button>
                  <button
                    onClick={() => void downloadOutputFile(art.filename)}
                    className="flex items-center gap-1.5 border border-signal/30 bg-signal/8 px-2.5 py-1 text-[9px] text-signal hover:bg-signal/15 transition-colors"
                  >
                    <Icon icon={Download} size={11} />
                    Download
                  </button>
                </div>
              </div>
            ))}
            {previewError && <div className="border border-danger/30 bg-danger/10 p-2 text-[9px] text-danger">{previewError}</div>}
            {artifactPreview && <div className="border border-line bg-ink/50 p-3"><div className="mb-2 flex items-center justify-between font-mono text-[9px] text-muted"><span>{artifactPreview.filename}</span><button onClick={() => setArtifactPreview(null)}>Close</button></div><MarkdownContent content={artifactPreview.content} className="text-[10px]" /></div>}
          </div>
        )}

        {/* VERIFY tab — actual verification checks, not a pass/total "AI confidence" */}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            {!verification && !loading && (
              <div className="py-10 text-center text-[10px] text-slate-600">
                Verification will run after task completes — checks include source grounding, artifact integrity, and policy
              </div>
            )}
            {loading && !verification && (
              <div className="py-10 text-center">
                <div className="inline-flex items-center gap-2 text-[10px] text-muted">
                  <Icon icon={ShieldCheck} size={14} className="text-signal animate-pulse" />
                  Verifying…
                </div>
              </div>
            )}
            {verification && (
              <>
                <div className="border border-line bg-panel/50 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted mb-3">
                    Verification
                  </div>
                  <div className="space-y-2">
                    {verification.checks.map((check, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <Icon
                          icon={check.passed ? CheckCircle2 : XCircle}
                          size={13}
                          className={check.passed ? 'text-signal shrink-0' : 'text-danger shrink-0'}
                        />
                        <div className="flex-1">
                          <div className="text-[10px] text-slate-200">{check.label}</div>
                          {check.detail && (
                            <div className="text-[9px] text-muted">{check.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verification score — not "AI confidence" */}
                <div className="border border-line bg-panel/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted">Verification Score</span>
                    <span className="font-mono text-sm font-bold text-signal">
                      {verification.checks.filter(c=>c.passed).length}/{verification.checks.length} · {Math.round(verification.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink/60">
                    <div
                      className="h-full rounded-full bg-signal transition-all"
                      style={{ width: `${verification.confidence * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Icon
                      icon={verification.passed ? CheckCircle2 : AlertCircle}
                      size={12}
                      className={verification.passed ? 'text-signal' : 'text-danger'}
                    />
                    <span className={`font-mono text-[9px] uppercase font-bold ${verification.passed ? 'text-signal' : 'text-danger'}`}>
                      {verification.passed ? 'VERIFIED' : 'NEEDS REVIEW'}
                    </span>
                  </div>
                  {verification.summary && (
                    <p className="mt-2 text-[9px] leading-4 text-muted">{verification.summary}</p>
                  )}
                </div>

                <div className="border border-line bg-panel/50 p-4 font-mono text-[9px]">
                  <div className="mb-2 uppercase tracking-[0.12em] text-muted">Artifact Integrity</div>
                  {artifacts.length === 0 ? <div className="text-slate-500">No artifact generated for this task</div> : artifacts.map((artifact) => <div key={artifact.id} className="space-y-1"><div className="text-slate-300">{artifact.filename}</div><div className={artifact.sha256 ? 'break-all text-signal' : 'text-danger'}>{artifact.sha256 ? `SHA-256 ${artifact.sha256}` : 'SHA-256 unavailable'}</div></div>)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
