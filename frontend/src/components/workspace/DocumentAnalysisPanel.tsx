import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, ShieldAlert } from 'lucide-react'
import type { UploadedFile } from '../../lib/types'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'

interface DocumentAnalysisPanelProps {
  selectedFile: UploadedFile | null
  response: string
  steps: string[]
  loading: boolean
  onGenerateReport: () => void
}

function extractSummary(response: string): { finding: string; action: string; severity: 'HIGH' | 'MEDIUM' } {
  if (!response.trim()) {
    return {
      finding: 'No extracted finding yet. Run a document task to populate detected issues and risk details.',
      action: 'Run OCR and cross-reference against local maintenance procedures before issuing a field order.',
      severity: 'MEDIUM',
    }
  }

  const compact = response.replace(/\s+/g, ' ').trim()
  const finding = compact.slice(0, 220)
  const severity = /(high|critical|severe|urgent)/i.test(compact) ? 'HIGH' : 'MEDIUM'
  const actionMatch = compact.match(/(recommend(?:ed)? action[:\-]?\s*)(.*)$/i)
  const action = actionMatch?.[2]?.slice(0, 220) || 'Escalate to inspection crew and validate with ultrasonic thickness readings in the next maintenance window.'
  return { finding, action, severity }
}

function makeInspectionId(filename?: string): string {
  if (!filename) return 'INS-2026-103'
  let checksum = 0
  for (const char of filename) checksum = (checksum + char.charCodeAt(0)) % 900
  return `INS-2026-${String(checksum + 100).padStart(3, '0')}`
}

export function DocumentAnalysisPanel({ selectedFile, response, steps, loading, onGenerateReport }: DocumentAnalysisPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string>()

  useEffect(() => {
    if (!selectedFile || selectedFile.type !== 'image') {
      setPreviewUrl(undefined)
      return
    }
    const url = URL.createObjectURL(selectedFile.file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const summary = useMemo(() => extractSummary(response), [response])
  const trace = steps.length
    ? steps
    : [
      'OCR extraction complete',
      'Vision model analyzed drawing',
      'Cross-referenced with local knowledge base',
      'Severity scoring complete',
    ]

  return (
    <Panel className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-[30px]">Document Analysis</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Review extracted findings and agent reasoning.</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start border border-signal/25 bg-signal-dim/35 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-signal sm:self-auto">
          <span className="size-1.5 rounded-full bg-signal" />Agent active
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
        <section className="overflow-hidden border border-line bg-navy">
          <div className="relative min-h-[320px] border-b border-line document-preview-surface p-5">
            {previewUrl ? (
              <img src={previewUrl} alt={selectedFile?.file.name || 'Source document'} className="h-full max-h-[340px] w-full object-contain opacity-90" />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center border border-line bg-raised/70 p-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 size-12 border border-line bg-raised/70" />
                  <p className="text-xs text-slate-300">Attach an image or PDF to preview source material.</p>
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.11em] text-slate-500">
            Source: {selectedFile?.file.name || 'Schematic_Final_V3.pdf'}
          </div>
        </section>

        <section className="space-y-3 border border-line bg-panel p-4 sm:p-5">
          <div className="mb-1 flex items-center gap-2 text-slate-100">
            <Icon icon={ClipboardList} size={16} className="text-signal" />
            <h3 className="text-base font-medium">Extracted Information</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-line/90 bg-ink/45 px-3 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.11em] text-slate-500">Inspection ID</div>
              <div className="mt-2 text-lg font-semibold text-signal">{makeInspectionId(selectedFile?.file.name)}</div>
            </div>
            <div className="border border-danger/35 bg-danger/10 px-3 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.11em] text-slate-500">Severity</div>
              <div className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-danger">
                <Icon icon={ShieldAlert} size={15} />
                {summary.severity}
              </div>
            </div>
          </div>

          <div className="border border-line/90 bg-ink/45 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.11em] text-slate-500">Finding</div>
            <p className="mt-2 text-sm leading-6 text-slate-200">{summary.finding}</p>
          </div>

          <div className="border border-signal/25 bg-signal-dim/20 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.11em] text-signal">Recommended action</div>
            <p className="mt-2 text-sm leading-6 text-slate-200">{summary.action}</p>
          </div>
        </section>
      </div>

      <section className="mt-4 border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-medium text-slate-100">Agent Reasoning Trace</h3>
          <span className="border border-signal/25 bg-signal-dim/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-signal">{trace.length} steps</span>
        </div>
        <ol className="space-y-0 px-4 py-2">
          {trace.map((step, index) => (
            <li key={`${step}-${index}`} className="flex items-start gap-2 border-b border-line/40 py-3 last:border-0">
              <Icon icon={CheckCircle2} size={14} className="mt-0.5 shrink-0 text-signal" />
              <span className="text-xs leading-6 text-slate-300">{step.replace(/^\[[^\]]+\]\s*/, '')}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={onGenerateReport}
          className="inline-flex min-h-11 items-center justify-center gap-2 bg-signal px-5 text-xs font-semibold uppercase tracking-[0.08em] text-action transition-colors hover:bg-signal/80 disabled:cursor-not-allowed disabled:bg-raised disabled:text-slate-500"
        >
          {loading ? 'Running...' : 'Generate report'}
        </button>
      </div>
    </Panel>
  )
}