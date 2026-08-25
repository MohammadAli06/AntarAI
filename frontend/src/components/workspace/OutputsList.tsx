import { Download, RefreshCw } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { EmptyState } from '../ui/EmptyState'
import { Panel } from '../ui/Panel'
import { StatusBadge } from '../ui/StatusBadge'
import { getFileIcon, formatFileSize } from '../../lib/utils'
import type { OutputFile } from '../../lib/types'

interface OutputsListProps {
  outputs: OutputFile[]
  loading: boolean
  error?: string
  onRefresh: () => void
}

export function OutputsList({ outputs, loading, error, onRefresh }: OutputsListProps) {
  return <Panel className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><div className="eyebrow mb-1">Generated artifacts</div><h2 className="section-title">Outputs</h2></div><button onClick={onRefresh} className="flex size-9 items-center justify-center text-muted hover:text-slate-100" aria-label="Refresh outputs"><Icon icon={RefreshCw} size={15} className={loading ? 'animate-spin' : ''} /></button></div>
    {error ? <div className="px-5 py-8 text-center text-xs text-danger">{error}</div> : outputs.length === 0 ? <EmptyState title="No generated files" description="Reports, spreadsheets, and code artifacts created by local tools will be listed here." /> : <div className="divide-y divide-line/70">{outputs.map((output) => { const FileIcon = getFileIcon(output.type || output.name); return <div key={`${output.name}-${output.url}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-raised/25 sm:px-5"><span className="flex size-9 shrink-0 items-center justify-center border border-line bg-ink/35 text-signal"><Icon icon={FileIcon} size={16} /></span><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-200">{output.name}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-muted"><StatusBadge tone="neutral" compact>{output.type}</StatusBadge><span>{formatFileSize(output.sizeBytes)}</span></div></div><a href={output.url} download={output.name} target="_blank" rel="noreferrer" className="flex size-9 shrink-0 items-center justify-center text-muted hover:text-signal" aria-label={`Download ${output.name}`}><Icon icon={Download} size={16} /></a></div> })}</div>}
  </Panel>
}
