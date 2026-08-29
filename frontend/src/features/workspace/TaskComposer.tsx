import { useEffect, useRef, useState } from 'react'
import { Code, LayoutTemplate, Paperclip, Play, Send, X } from 'lucide-react'
import { Icon } from '../../components/ui/Icon'
import type { WorkflowTemplate } from '../../lib/types'

interface TaskComposerProps {
  onSubmit: (prompt: string, file?: File) => void
  loading: boolean
  initialPrompt?: string
  template?: WorkflowTemplate | null
  onOpenTemplates?: () => void
}

export function TaskComposer({ onSubmit, loading, initialPrompt = '', template, onOpenTemplates }: TaskComposerProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt)
  }, [initialPrompt])

  function handleSubmit() {
    if (!prompt.trim() || loading) return
    onSubmit(prompt.trim(), file ?? undefined)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }

  return (
    <div className="border-t border-line bg-panel/70 p-3.5 space-y-2.5">
      {/* Template hint */}
      {template && (
        <div className="flex items-center gap-2 rounded border border-signal/30 bg-signal/8 px-3 py-1.5">
          <span className="text-base">{template.icon}</span>
          <span className="text-xs text-signal font-semibold">{template.title}</span>
          <span className="ml-auto font-mono text-[9px] text-muted">{template.expectedDeliverable}</span>
        </div>
      )}

      {/* Attached file chip */}
      {file && (
        <div className="flex items-center gap-2 rounded border border-line bg-ink/70 px-3 py-1.5">
          <Icon icon={Paperclip} size={12} className="text-signal shrink-0" />
          <span className="flex-1 truncate font-mono text-[10px] text-slate-200">{file.name}</span>
          <button
            onClick={() => setFile(null)}
            className="text-muted hover:text-danger transition-colors"
            aria-label="Remove file"
          >
            <Icon icon={X} size={12} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="rounded border border-line bg-ink/70 p-2.5 focus-within:border-signal/70 focus-within:ring-1 focus-within:ring-signal/30 transition-all">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          rows={2}
          placeholder="Direct the agent or refine parameters..."
          className="w-full resize-none bg-transparent text-xs text-slate-100 placeholder:text-slate-500 outline-none leading-5 disabled:opacity-50"
          aria-label="Task prompt"
        />

        {/* Toolbar & Action row */}
        <div className="flex items-center justify-between pt-2 border-t border-line/40">
          <div className="flex items-center gap-2">
            {/* File attach */}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex size-7 items-center justify-center rounded text-slate-400 hover:text-signal hover:bg-panel transition-colors"
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

            {/* Code template / curly braces */}
            <button
              onClick={() => setPrompt((p) => (p ? `${p}\n\`\`\`python\n\n\`\`\`` : '```python\n\n```'))}
              className="flex size-7 items-center justify-center rounded text-slate-400 hover:text-signal hover:bg-panel transition-colors"
              title="Insert code block"
            >
              <Icon icon={Code} size={14} />
            </button>

            {/* Templates shortcut */}
            <button type="button" onClick={onOpenTemplates} className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-slate-400 px-2 py-0.5 rounded hover:text-slate-200 cursor-pointer">
              <Icon icon={LayoutTemplate} size={12} className="text-signal" />
              <span>Templates</span>
            </button>
          </div>

          {/* Run button matching Screenshot 2 */}
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-1.5 rounded bg-signal px-4 py-1.5 text-xs font-semibold text-action shadow-[0_0_14px_rgba(249,115,22,0.3)] transition-all hover:bg-orange-600 hover:shadow-[0_0_20px_rgba(249,115,22,0.45)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon icon={Play} size={12} className="fill-current" />
            <span>Run Task</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
        <span>Ctrl+Enter to execute</span>
        <span className="text-signal">100% Local · Air-Gapped Engine</span>
      </div>
    </div>
  )
}
