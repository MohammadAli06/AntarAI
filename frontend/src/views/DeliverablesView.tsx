/**
 * DeliverablesView — Engineer output file listing.
 *
 * Fetches GET /outputs for the file list and GET /tasks/mine for
 * status/risk context on each generated file.
 */
import { useEffect, useState } from 'react'
import {
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Package,
} from 'lucide-react'
import { fetchOutputs, fetchTasks, downloadOutputFile } from '../lib/api'
import type { OutputFile, TaskItem, RiskLevel } from '../lib/types'
import { Icon } from '../components/ui/Icon'

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'border-signal/30 bg-signal/8 text-signal',
  medium: 'border-warning/30 bg-warning/8 text-warning',
  high: 'border-danger/30 bg-danger/8 text-danger',
  critical: 'border-danger bg-danger/20 text-danger font-bold',
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'border-signal/30 bg-signal/8 text-signal',
  completed: 'border-signal/20 bg-signal/5 text-signal',
  pending_approval: 'border-warning/30 bg-warning/8 text-warning',
  rejected: 'border-danger/30 bg-danger/8 text-danger',
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'py' || ext === 'js' || ext === 'ts' || ext === 'json') return FileCode
  if (ext === 'xlsx' || ext === 'csv' || ext === 'xls') return FileSpreadsheet
  return FileText
}

function formatBytes(bytes?: number) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

interface EnrichedOutput extends OutputFile {
  task?: TaskItem
}

export function DeliverablesView() {
  const [outputs, setOutputs] = useState<EnrichedOutput[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [files, tasks] = await Promise.all([fetchOutputs(), fetchTasks(true)])
      // Join output files with task metadata by filename
      const enriched: EnrichedOutput[] = files.map((f) => ({
        ...f,
        task: tasks.find((t) => t.generatedFile === f.name),
      }))
      setOutputs(enriched)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load deliverables')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleDownload(filename: string) {
    setDownloading(filename)
    try {
      await downloadOutputFile(filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-1.5">
            <Icon icon={Package} size={11} />
            Engineer deliverables
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Deliverables</h2>
          <p className="mt-1 text-xs text-muted">
            AI-generated output files from your tasks — all processed on-premise
          </p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-2 border border-line bg-panel/60 px-3 py-1.5 text-xs text-slate-300 hover:border-signal/40 hover:text-signal transition-colors"
        >
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 border border-line bg-panel/40 px-4 py-3 text-xs text-muted">
        <span className="font-bold text-slate-200 tabular-nums">{outputs.length}</span> files generated
        <span className="text-slate-700">·</span>
        <span className="font-bold text-slate-200 tabular-nums">
          {outputs.filter((o) => o.task?.status === 'approved').length}
        </span> approved
        <span className="text-slate-700">·</span>
        <span className="font-bold text-slate-200 tabular-nums">
          {outputs.filter((o) => o.task?.status === 'pending_approval').length}
        </span> pending review
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-signal">
          <span className="size-1.5 rounded-full bg-signal animate-pulse" />
          AIR-GAPPED
        </span>
      </div>

      {error && (
        <div className="border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">{error}</div>
      )}

      {/* File grid */}
      {loading ? (
        <div className="border border-line bg-panel/30 p-12 text-center text-xs text-slate-500">
          Loading deliverables…
        </div>
      ) : outputs.length === 0 ? (
        <div className="border border-line/60 bg-panel/20 p-12 text-center text-xs text-slate-500">
          No deliverables yet. Submit a task in the Workspace to generate your first output.
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((output) => {
            const FIcon = fileIcon(output.name)
            const task = output.task
            return (
              <div
                key={output.name}
                className="flex items-center gap-4 border border-line bg-panel/50 px-4 py-3 transition-colors hover:border-signal/20 hover:bg-panel"
              >
                {/* File type icon */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded border border-line bg-ink/40">
                  <Icon icon={FIcon} size={16} className="text-signal" />
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-200">{output.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted">
                    <span>{output.type}</span>
                    <span className="text-slate-700">·</span>
                    <span>{formatBytes(output.sizeBytes)}</span>
                    {task && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span>TASK-{task.id}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Risk badge */}
                {task?.risk && (
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase ${RISK_STYLE[task.risk as RiskLevel]}`}
                  >
                    {task.risk}
                  </span>
                )}

                {/* Status badge */}
                {task?.status && (
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_STYLE[task.status] ?? 'border-line bg-panel text-muted'}`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                )}

                {/* Download */}
                <button
                  onClick={() => handleDownload(output.name)}
                  disabled={downloading === output.name}
                  className="flex shrink-0 items-center gap-1.5 border border-signal/30 bg-signal/8 px-3 py-1.5 text-[10px] font-semibold text-signal hover:bg-signal/15 transition-colors disabled:opacity-50"
                >
                  <Icon
                    icon={Download}
                    size={12}
                    className={downloading === output.name ? 'animate-bounce' : ''}
                  />
                  {downloading === output.name ? 'Downloading…' : 'Download'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
