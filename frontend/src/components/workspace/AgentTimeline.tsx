import { useEffect, useState } from 'react'
import { Check, Circle, LoaderCircle } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'

interface AgentTimelineProps {
  steps: string[]
  loading: boolean
}

function cleanStep(step: string): string {
  return step.replace(/^\[[^\]]+\]\s*/, '').replace(/^[^\w]+\s*/, '')
}

export function AgentTimeline({ steps, loading }: AgentTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0)
    if (!steps.length) return
    const timers = steps.map((_, index) => window.setTimeout(() => setVisibleCount(index + 1), index * 400 + 120))
    return () => timers.forEach(window.clearTimeout)
  }, [steps])

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="eyebrow mb-2">Execution trace</div><h2 className="section-title">Agent activity</h2></div>
        {loading ? <Spinner label="Processing" /> : steps.length > 0 && <span className="font-mono text-[10px] text-muted">{visibleCount}/{steps.length} steps</span>}
      </div>
      {steps.length === 0 ? (
        <div className="mt-5 flex min-h-[150px] items-center border border-dashed border-line bg-ink/20 px-5"><div className="max-w-xs"><p className="text-xs font-medium text-slate-300">Execution steps will appear here</p><p className="mt-1 text-xs leading-5 text-muted">Run a task to inspect classification, routing, and local model activity.</p></div></div>
      ) : (
        <ol className="mt-6 space-y-0" aria-live="polite" aria-label="Agent activity steps">
          {steps.map((step, index) => {
            const isVisible = index < visibleCount
            const complete = index < visibleCount - 1 || (!loading && index < visibleCount)
            const current = isVisible && !complete
            return <li key={`${step}-${index}`} className={`relative flex gap-3 ${index < steps.length - 1 ? 'pb-5' : ''} ${isVisible ? 'timeline-appear' : 'invisible'}`}>
              {index < steps.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-px ${index < visibleCount - 1 ? 'bg-signal/45' : 'bg-line'}`} />}
              <span className={`relative z-10 flex size-[19px] shrink-0 items-center justify-center border ${complete ? 'border-signal bg-signal text-action' : current ? 'border-signal bg-signal-dim text-signal' : 'border-line bg-raised text-slate-600'}`}>
                {complete ? <Icon icon={Check} size={12} strokeWidth={2.5} /> : current ? <Icon icon={LoaderCircle} size={12} className="animate-spin" /> : <Icon icon={Circle} size={7} />}
              </span>
              <div className="min-w-0 pt-0.5"><p className={`text-xs leading-5 ${complete ? 'text-slate-300' : current ? 'text-signal' : 'text-muted'}`}>{cleanStep(step)}</p>{current && <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">In progress</p>}</div>
            </li>
          })}
        </ol>
      )}
    </Panel>
  )
}
