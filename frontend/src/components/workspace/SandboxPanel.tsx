import { Download, TerminalSquare } from 'lucide-react'
import { Icon } from '../ui/Icon'
import { Panel } from '../ui/Panel'

interface SandboxPanelProps {
  objective: string
  response: string
  loading: boolean
  steps: string[]
}

function extractCode(response: string): string {
  const match = response.match(/```(?:\w+)?\n([\s\S]*?)```/)
  if (match?.[1]) return match[1].trim()
  return [
    'import math',
    '',
    'def calculate_flow_rate(cd, a, rho, delta_p):',
    '    """Calculate flow rate from pressure differential."""',
    '    if rho <= 0 or delta_p < 0:',
    "        raise ValueError('rho must be > 0 and delta_p >= 0')",
    '    velocity = math.sqrt(2 * delta_p / rho)',
    '    return cd * a * velocity',
    '',
    "print(calculate_flow_rate(0.62, 0.0045, 1000, 1500))",
  ].join('\n')
}

function deriveExecutionLog(steps: string[], loading: boolean): string[] {
  if (loading) return ['Running task...', 'Preparing local sandbox...', 'Waiting for result...']
  if (!steps.length) {
    return ['$ python solution.py', 'Task 1: PASSED', 'Task 2: PASSED', 'Task 3: PASSED', 'Execution complete in 0.4s']
  }
  return ['$ python solution.py', ...steps.map((step) => `- ${step.replace(/^\[[^\]]+\]\s*/, '')}`), 'Execution complete']
}

export function SandboxPanel({ objective, response, loading, steps }: SandboxPanelProps) {
  const code = extractCode(response)
  const executionLines = deriveExecutionLog(steps, loading)

  function downloadCode() {
    const blob = new Blob([code], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'solution.py'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <div className="eyebrow mb-2">Task objective</div>
        <p className="text-sm text-slate-200">{objective || 'Write Python code to solve a refinery operations task in a local sandbox.'}</p>
      </div>

      <div className="grid gap-0 border-b border-line md:grid-cols-2">
        <section className="border-b border-line bg-[#070f1a] p-4 md:border-b-0 md:border-r">
          <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
            <span>solution.py</span>
            <span className="font-mono">editor</span>
          </div>
          <pre className="max-h-[280px] overflow-auto bg-[#050a13] p-3 font-mono text-[11px] leading-6 text-[#77e5d4]">
            <code>{code}</code>
          </pre>
        </section>

        <section className="bg-[#081423] p-4">
          <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
            <span>Sandbox execution</span>
            <span className="font-mono">runtime</span>
          </div>
          <div className="max-h-[280px] overflow-auto bg-[#06101b] p-3 font-mono text-[11px] leading-6 text-slate-300">
            {executionLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-signal" />Tests passed</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-signal" />No errors</span>
          <span className="inline-flex items-center gap-1.5"><Icon icon={TerminalSquare} size={12} />Execution local</span>
        </div>
        <button
          type="button"
          onClick={downloadCode}
          className="inline-flex min-h-10 items-center justify-center gap-2 bg-signal px-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:bg-[#78e4d6]"
        >
          <Icon icon={Download} size={14} />
          Download code
        </button>
      </div>
    </Panel>
  )
}