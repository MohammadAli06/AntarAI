import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { WorkflowTemplate } from '../../lib/types'

interface TaskComposerProps {
  onSubmit: (prompt: string, file?: File) => void
  loading: boolean
  initialPrompt?: string
  template?: WorkflowTemplate | null
}

export function TaskComposer({ onSubmit, loading, initialPrompt = '', template }: TaskComposerProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit() {
    if (!prompt.trim() || loading) return
    onSubmit(prompt.trim(), file ?? undefined)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  return (
    <div className="bg-ink/60 p-3">
      {/* Template hint */}
      {template && (
        <div className="mb-2 flex items-center gap-2 border border-signal/20 bg-signal/5 px-3 py-1.5">
          <span className="text-base">{template.icon}</span>
          <span className="text-[10px] text-signal font-medium">{template.title}</span>
          <span className="ml-auto text-[9px] text-muted">{template.expectedDeliverable}</span>
        </div>
      )}

      {/* Attached file chip */}
      {file && (
        <div className="mb-2 flex items-center gap-2 border border-line bg-panel/60 px-2.5 py-1.5">
          <Icon icon={Paperclip} size={11} className="text-signal shrink-0" />
          <span className="flex-1 truncate font-mono text-[9px] text-slate-300">{file.name}</span>
          <button
            onClick={() => setFile(null)}
            className="text-muted hover:text-danger transition-colors"
            aria-label="Remove file"
          >
            <Icon icon={X} size={11} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* File attach */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex size-9 shrink-0 items-center justify-center border border-line bg-panel text-muted hover:border-signal/40 hover:text-signal transition-colors"
          aria-label="Attach file"
          title="Attach file"
        >
          <Icon icon={Paperclip} size={14} />
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.py,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        {/* Prompt input */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          rows={2}
          placeholder="Ask AntarAI... (Ctrl+Enter to run)"
          className="control-input flex-1 resize-none px-3 py-2.5 text-xs leading-5 disabled:opacity-50"
          aria-label="Task prompt"
        />

        {/* Run button */}
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading}
          className="flex shrink-0 items-center gap-2 border border-signal/40 bg-signal-dim/35 px-4 py-2.5 text-xs font-semibold text-signal transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon icon={Send} size={13} />
          <span className="hidden sm:inline">Run Task</span>
          <span className="sm:hidden">→</span>
        </button>
      </div>

      <div className="mt-1.5 text-[9px] text-slate-700">
        Ctrl+Enter to run · All execution is local · Zero egress
      </div>
    </div>
  )
}
