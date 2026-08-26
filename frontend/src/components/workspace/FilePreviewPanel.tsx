import { useEffect, useState } from 'react'
import { FileText, Image, ScanSearch, X } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'
import { StatusBadge } from '../ui/StatusBadge'
import type { UploadedFile } from '../../lib/types'

interface FilePreviewPanelProps { selectedFile: UploadedFile; onRemove: () => void }

export function FilePreviewPanel({ selectedFile, onRemove }: FilePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string>()
  useEffect(() => {
    if (selectedFile.type !== 'image') { setPreviewUrl(undefined); return }
    const url = URL.createObjectURL(selectedFile.file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  return <Panel className="overflow-hidden panel-enter">
    <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2"><Icon icon={ScanSearch} size={15} className="text-signal" /><div><div className="eyebrow">Input preview</div><h2 className="mt-1 section-title">Attached file</h2></div></div><button onClick={onRemove} className="flex size-9 items-center justify-center text-muted hover:text-slate-100" aria-label="Remove attached file"><Icon icon={X} size={16} /></button></div>
    <div className="grid md:grid-cols-2">
      <div className="flex min-h-[220px] items-center justify-center border-b border-line bg-navy p-4 md:border-b-0 md:border-r">{previewUrl ? <img src={previewUrl} alt={`Preview of ${selectedFile.file.name}`} className="max-h-[260px] max-w-full object-contain" /> : <div className="text-center"><span className="mx-auto flex size-14 items-center justify-center border border-line bg-raised text-signal"><Icon icon={selectedFile.type === 'pdf' ? FileText : Image} size={27} strokeWidth={1.4} /></span><p className="mt-4 max-w-[190px] truncate text-xs font-medium text-slate-300">{selectedFile.file.name}</p><p className="mt-1 text-[10px] text-muted">PDF preview will be available here</p></div>}</div>
      <div className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div className="eyebrow">Extracted information</div><StatusBadge tone="neutral" compact>OCR pending</StatusBadge></div><div className="flex min-h-[165px] items-center justify-center border border-dashed border-line bg-ink/20 p-5 text-center"><div><Icon icon={ScanSearch} size={21} className="mx-auto mb-3 text-slate-600" /><p className="text-xs text-slate-400">Structured fields will appear after OCR is connected.</p><p className="mt-1 text-[10px] leading-4 text-muted">The file is ready for a vision model task.</p></div></div></div>
    </div>
  </Panel>
}
