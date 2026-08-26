import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUp, FilePlus2, FileText, Image, X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'
import { getUploadType } from '../../lib/utils'
import type { UploadedFile } from '../../lib/types'

interface TaskInputPanelProps {
  onSubmit: (message: string, file?: File) => void
  loading: boolean
  selectedFile: UploadedFile | null
  onFileSelect: (file: File | null) => void
}

export function TaskInputPanel({ onSubmit, loading, selectedFile, onFileSelect }: TaskInputPanelProps) {
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function acceptFile(file?: File) {
    if (!file) return
    if (!getUploadType(file)) {
      setFileError('Use a PDF or image file.')
      return
    }
    setFileError('')
    onFileSelect(file)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim() || loading) return
    onSubmit(message.trim(), selectedFile?.file)
  }

  return (
    <Panel className="p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Task input</div>
          <h2 className="section-title text-base">What should AntarAI work on?</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Your prompt and files stay inside the MRPL network.</p>
        </div>
        <span className="hidden border border-signal/20 bg-signal-dim/35 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-signal sm:inline">Local session</span>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="task-message" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Describe the task</label>
        <textarea id="task-message" value={message} onChange={(event) => setMessage(event.target.value)} disabled={loading} rows={5} className="control-input min-h-[132px] w-full resize-y p-3 text-sm leading-6 transition-colors" placeholder="e.g. Analyse the maintenance log and highlight any safety-critical observations..." />

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <input ref={inputRef} type="file" accept="application/pdf,image/*" className="sr-only" onChange={(event) => acceptFile(event.target.files?.[0])} />
            <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files?.[0]) }} className={`flex min-h-[76px] w-full items-center gap-3 border border-dashed px-3 text-left transition-colors sm:min-w-[260px] ${isDragging ? 'border-signal bg-signal-dim/35' : 'border-line bg-ink/25 hover:border-slate-600 hover:bg-ink/40'}`}>
              <span className="flex size-9 shrink-0 items-center justify-center border border-line bg-raised/60 text-signal"><Icon icon={selectedFile?.type === 'image' ? Image : FilePlus2} size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-slate-200">{selectedFile ? selectedFile.file.name : 'Attach a PDF or image'}</span>
                <span className="mt-1 block text-[10px] text-muted">{selectedFile ? `${selectedFile.type === 'image' ? 'Image' : 'PDF'} ready for analysis` : 'Drop file here or browse'}</span>
              </span>
              {selectedFile && <span onClick={(event) => { event.stopPropagation(); onFileSelect(null) }} className="ml-auto flex size-8 shrink-0 items-center justify-center text-muted hover:text-slate-100" role="button" aria-label="Remove attached file"><Icon icon={X} size={15} /></span>}
            </button>
            {fileError && <p className="mt-2 text-[11px] text-danger" role="alert">{fileError}</p>}
          </div>
          <button type="submit" disabled={!message.trim() || loading} className="inline-flex min-h-11 items-center justify-center gap-2 bg-signal px-5 text-xs font-semibold uppercase tracking-[0.08em] text-action transition-colors hover:bg-signal/80 disabled:cursor-not-allowed disabled:bg-raised disabled:text-slate-500">
            {loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-action/30 border-t-action" /> : <Icon icon={ArrowUp} size={16} strokeWidth={2.2} />}
            {loading ? 'Running' : 'Run task'}
          </button>
        </div>
      </form>
      <div className="mt-4 flex items-center gap-2 border-t border-line/70 pt-3 text-[10px] text-slate-600"><Icon icon={FileText} size={13} /> Accepted inputs: PDF, PNG, JPG, TIFF</div>
    </Panel>
  )
}
