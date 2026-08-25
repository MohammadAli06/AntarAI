import { ArrowRight, Bot, Cable, Database, Lock, Shield, SquareTerminal } from 'lucide-react'
import { Icon } from '../components/ui/Icon'

interface LandingPageProps {
  onLogin: () => void
  onEnter: () => void
}

const faq = [
  {
    question: 'Which models are supported?',
    answer: 'Optimized for Qwen, Llama, and Mistral open-weight architectures.',
  },
  {
    question: 'How is it deployed?',
    answer: 'Single-node or clustered on-premise hardware via Docker/Kubernetes.',
  },
]

export function LandingPage({ onLogin, onEnter }: LandingPageProps) {
  return (
    <div className="landing-shell text-slate-100">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-[32px] font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded border border-signal/30 bg-signal-dim/50 text-signal">
            <Icon icon={Bot} size={16} />
          </span>
          <span className="text-xl">Sovereign AI Workbench</span>
        </div>
        <nav className="hidden items-center gap-8 text-xs text-slate-300 md:flex">
          <button className="text-signal">Home</button>
          <button>Capabilities</button>
          <button>Documentation</button>
        </nav>
        <button onClick={onLogin} className="rounded border border-signal/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-signal hover:bg-signal-dim/30">Login</button>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-5 pb-12 pt-6 sm:px-8 sm:pt-8">
        <section className="text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel/40 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300">
            <span className="size-2 rounded-full bg-signal" />System status: air-gapped
          </div>
          <h1 className="mx-auto max-w-[760px] text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Confidential AI,<nobr> </nobr>Fully On-Premise</h1>
          <p className="mx-auto mt-6 max-w-[760px] text-base leading-8 text-slate-300">
            An air-gapped agentic AI assistant for industrial knowledge work. Zero data leaves your infrastructure, built for highly regulated environments.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs">
            <span className="rounded border border-line bg-panel/35 px-3 py-2">Zero External Calls</span>
            <span className="rounded border border-line bg-panel/35 px-3 py-2">Runs Fully Local</span>
            <span className="rounded border border-line bg-panel/35 px-3 py-2">Open-Weight Models</span>
          </div>

          <button onClick={onEnter} className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded bg-signal px-8 text-sm font-semibold text-ink transition-colors hover:bg-[#79e8d9]">
            Enter Workbench <Icon icon={ArrowRight} size={16} />
          </button>
        </section>

        <section className="mt-14 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: 'Agentic Automation',
              body: 'Plans and executes multi-step tasks with local tools. Automates complex workflows without relying on external API orchestration.',
              icon: SquareTerminal,
            },
            {
              title: 'Multimodal Understanding',
              body: 'Reads scanned documents, engineering drawings, and photographs. Extracts structured data from unstructured physical media.',
              icon: Cable,
            },
            {
              title: 'Grounded in Your Data',
              body: 'Answers sourced exclusively from your organization documents corpus using local RAG vector databases.',
              icon: Database,
            },
          ].map((item) => (
            <article key={item.title} className="rounded border border-line bg-panel/60 p-6">
              <span className="mb-4 flex size-11 items-center justify-center rounded border border-line bg-raised text-signal"><Icon icon={item.icon} size={18} /></span>
              <h3 className="text-2xl font-medium tracking-tight text-slate-100">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-14 max-w-[820px]">
          <h2 className="mb-5 text-center text-4xl font-semibold tracking-tight">Technical FAQ</h2>
          <div className="space-y-3">
            {faq.map((item) => (
              <article key={item.question} className="overflow-hidden rounded border border-line bg-panel/45">
                <h3 className="border-b border-line px-4 py-3 text-sm text-slate-100">{item.question}</h3>
                <p className="px-4 py-3 text-sm text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-4xl font-semibold tracking-tight">Air-Gapped by Design</h2>
          <p className="mt-2 text-center text-sm text-slate-300">How we ensure absolute data sovereignty.</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <article className="rounded border border-line bg-panel/60 p-6">
              <h3 className="mb-3 flex items-center gap-2 text-xl font-medium text-signal"><Icon icon={Shield} size={17} /> Compute Stack</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>- NVIDIA L40S Optimized</li>
                <li>- Local LLM Runtime</li>
                <li>- Encrypted Model Storage</li>
              </ul>
            </article>
            <article className="rounded border border-line bg-panel/60 p-6">
              <h3 className="mb-3 flex items-center gap-2 text-xl font-medium text-signal"><Icon icon={Lock} size={17} /> Data Privacy</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>- Zero Telemetry</li>
                <li>- No External API Hooks</li>
                <li>- Local RAG Vector Store</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-16 rounded border border-line bg-panel/35 px-6 py-16 text-center sm:px-10">
          <h2 className="text-4xl font-semibold tracking-tight">Ready to secure your AI workloads?</h2>
          <button className="mt-8 rounded border border-signal px-8 py-3 font-mono text-sm uppercase tracking-[0.18em] text-signal">Request deployment specs</button>
        </section>
      </main>

      <footer className="border-t border-line/60 bg-[#081221] py-8 text-center text-[11px] uppercase tracking-[0.2em] text-slate-500">
        Built for MRPL | Smart India Hackathon 2026
      </footer>
    </div>
  )
}