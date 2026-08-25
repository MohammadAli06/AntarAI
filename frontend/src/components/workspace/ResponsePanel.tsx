import { Bot, CheckCircle2, Copy, FileOutput } from 'lucide-react'
import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'

interface ResponsePanelProps {
  response: string
  loading: boolean
  error?: string
}

function renderResponse(response: string) {
  const chunks = response.split(/(```[\s\S]*?```)/g)
  return chunks.map((chunk, index) => {
    if (chunk.startsWith('```')) {
      const code = chunk.replace(/^```\w*\n?/, '').replace(/```$/, '').trim()
      return <pre key={index} className="my-4 overflow-x-auto border border-line bg-[#091725] p-4 font-mono text-[11px] leading-6 text-signal/90"><code>{code}</code></pre>
    }
    return <span key={index}>{chunk.split('\n').map((line, lineIndex) => <span key={lineIndex}>{line}{lineIndex < chunk.split('\n').length - 1 && <br />}</span>)}</span>
  })
}

export function ResponsePanel({ response, loading, error }: ResponsePanelProps) {
  const [copied, setCopied] = useState(false)
  async function copyResponse() {
    if (!response) return
    await navigator.clipboard.writeText(response)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Panel className="min-h-[320px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center border border-line bg-raised text-signal"><Icon icon={Bot} size={15} /></span><div><div className="eyebrow">Local response</div><h2 className="mt-1 section-title">Analysis output</h2></div></div>
        {response && !loading && <button onClick={copyResponse} className="flex min-h-9 items-center gap-1.5 px-2 text-[10px] uppercase tracking-[0.1em] text-muted hover:text-slate-100" aria-label="Copy response">{copied ? <Icon icon={CheckCircle2} size={14} className="text-signal" /> : <Icon icon={Copy} size={14} />}{copied ? 'Copied' : 'Copy'}</button>}
      </div>
      <div className="pt-5" aria-live="polite">
        {loading ? <div className="flex min-h-[210px] items-center justify-center"><Spinner label="Generating local response" /></div> : error ? <div className="flex min-h-[210px] items-center justify-center text-center"><div><Icon icon={FileOutput} size={22} className="mx-auto mb-3 text-danger" /><p className="text-sm text-danger">{error}</p><p className="mt-1 text-xs text-muted">Check that the local API is running on port 8000.</p></div></div> : response ? <div className="max-w-[76ch] text-sm leading-7 text-slate-300">{renderResponse(response)}<div className="mt-6 flex items-center gap-2 border-t border-line/70 pt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-600"><span className="size-1.5 rounded-full bg-signal" />Generated on-premise / no external calls</div></div> : <div className="flex min-h-[210px] items-center justify-center text-center"><div><Icon icon={Bot} size={22} className="mx-auto mb-3 text-slate-600" /><p className="text-sm text-slate-400">No response yet</p><p className="mt-1 text-xs text-muted">Your task output will appear here.</p></div></div>}
      </div>
    </Panel>
  )
}
