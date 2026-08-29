import { ArrowRight, Bot, Cable, CheckCircle2, Cpu, Database, Lock, Shield, SquareTerminal, Zap } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import type { Theme } from '../lib/types'

interface LandingPageProps {
  theme: Theme
  onToggleTheme: () => void
  onLogin: () => void
  onEnter: () => void
}

const faq = [
  {
    question: 'Which open-weight models are supported?',
    answer: 'Natively optimized for Qwen 2.5/3 (8B, 32B, Coder, VL), Llama 3.1/3.2, and Mistral open architectures running on local GPU infrastructure.',
  },
  {
    question: 'How is air-gapped isolation guaranteed?',
    answer: 'All network sockets are bound to localhost/internal unix sockets with strictly enforced iptables / firewall rules blocking 100% outbound internet traffic.',
  },
  {
    question: 'How does deployment work in enterprise environments?',
    answer: 'Single-node (NVIDIA L40S/A100/H100) or clustered on-premise Kubernetes with encrypted model weights and air-gapped local vector storage.',
  },
]

export function LandingPage({ theme, onToggleTheme, onLogin, onEnter }: LandingPageProps) {
  return (
    <div className="landing-shell min-h-screen w-full overflow-x-hidden overflow-y-auto text-slate-100 selection:bg-signal selection:text-white">
      {/* ── Sticky Top Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center rounded border border-signal/40 bg-signal-dim/60 text-signal shadow-[0_0_16px_rgba(249,115,22,0.25)]">
              <Icon icon={Bot} size={18} />
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-signal ring-2 ring-ink" />
            </span>
            <div>
              <span className="text-base font-bold tracking-tight sm:text-lg">AntarAI</span>
              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 hidden sm:inline">
                Sovereign Workbench
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-xs font-medium text-slate-300 md:flex">
            <button className="text-signal transition-colors font-semibold">Home</button>
            <a href="#capabilities" className="hover:text-slate-100 transition-colors">Capabilities</a>
            <a href="#architecture" className="hover:text-slate-100 transition-colors">Air-Gapped Stack</a>
            <a href="#faq" className="hover:text-slate-100 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
            <button
              onClick={onLogin}
              className="group relative inline-flex items-center gap-1.5 rounded border border-signal/60 bg-signal/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-signal transition-all duration-150 hover:bg-signal hover:text-action hover:shadow-[0_0_18px_rgba(249,115,22,0.3)]"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Hero & Content ───────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        {/* Hero */}
        <section className="text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/8 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal shadow-[0_0_20px_rgba(249,115,22,0.12)]">
            <span className="size-2 rounded-full bg-signal animate-pulse" />
            Air-Gapped Sovereign AI System // MRPL V1
          </div>

          <h1 className="mx-auto max-w-[860px] text-4xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Confidential AI,{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Zero External Egress
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-[720px] text-base leading-relaxed text-slate-300 sm:text-lg">
            An air-gapped agentic assistant for mission-critical industrial engineering. All LLMs, vector search, OCR engines, and tools run on your local bare metal.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3.5 py-2 text-slate-300">
              <CheckCircle2 size={13} className="text-signal" /> 0 Outbound Sockets
            </span>
            <span className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3.5 py-2 text-slate-300">
              <CheckCircle2 size={13} className="text-signal" /> Local GPU Inference
            </span>
            <span className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3.5 py-2 text-slate-300">
              <CheckCircle2 size={13} className="text-signal" /> Enterprise RBAC & Audit
            </span>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onEnter}
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded bg-signal px-8 text-sm font-semibold text-action shadow-[0_0_28px_rgba(249,115,22,0.35)] transition-all hover:bg-orange-600 hover:shadow-[0_0_36px_rgba(249,115,22,0.5)]"
            >
              Enter Workbench <Icon icon={ArrowRight} size={16} />
            </button>
            <button
              onClick={onLogin}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded border border-line bg-panel/60 px-6 text-sm font-medium text-slate-200 transition-colors hover:border-signal/40 hover:text-signal"
            >
              Operator Login
            </button>
          </div>
        </section>

        {/* Live System Indicator Terminal Mock */}
        <section className="mt-14 overflow-hidden rounded-lg border border-line bg-[#0a0d12] shadow-panel">
          <div className="flex items-center justify-between border-b border-line/60 bg-ink/70 px-4 py-2.5">
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
              <span className="size-2 rounded-full bg-signal" />
              <span>Antar AI // SOVEREIGN_DAEMON</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px] text-slate-500">
              <span className="text-signal">EGRESS: BLOCKED</span>
              <span>GPU: 63%</span>
              <span>VRAM: 11.4GB</span>
            </div>
          </div>
          <div className="p-4 font-mono text-[11px] leading-6 text-slate-300 sm:p-5">
            <div className="text-slate-500">14:02:11.402 <span className="text-signal font-semibold">[INFO]</span> Sovereign task router initialized. Node: air-gap-node-01</div>
            <div className="text-slate-500">14:02:15.891 <span className="text-signal font-semibold">[RETR]</span> RAG local vector search: 4 chunks retrieved from SOP-PUMP-042 (dim: 1536)</div>
            <div className="text-slate-500">14:02:18.003 <span className="text-signal font-semibold">[INFO]</span> Model context compiled: Qwen3-8B local engine online</div>
            <div className="text-slate-500">14:02:22.115 <span className="text-danger font-semibold">[BLOCK]</span> Outbound egress blocked: 104.21.55.21:443. Rule: Default_Deny_All</div>
            <div className="text-slate-500">14:02:25.992 <span className="text-signal font-semibold">[VERIFY]</span> SHA256 model checksum validated. Zero leakage guaranteed.</div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="capabilities" className="mt-20 scroll-mt-24">
          <div className="text-center mb-10">
            <div className="eyebrow mb-2">Core Engine</div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">Autonomous Industrial Intelligence</h2>
            <p className="mt-2 text-sm text-slate-400">Engineered specifically for plant operations, refineries, and strictly governed infrastructure.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: 'Agentic Multi-Step Workflow',
                body: 'Automatically plans, calls local Python sandboxes, routes between specialized models, and synthesizes engineering reports.',
                icon: SquareTerminal,
                badge: 'Agent Core',
              },
              {
                title: 'Multimodal Document Engine',
                body: 'Processes P&ID diagrams, scanned inspection reports, and equipment photos using local computer vision and OCR pipelines.',
                icon: Cable,
                badge: 'Local OCR',
              },
              {
                title: 'Grounded Enterprise RAG',
                body: 'All answers strictly cited against your organization standard operating procedures with precision chunk indexing.',
                icon: Database,
                badge: 'Local Vector DB',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-panel/70 p-6 transition-all duration-200 hover:border-signal/40 hover:bg-panel"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded border border-signal/30 bg-signal-dim/40 text-signal shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                      <Icon icon={item.icon} size={20} />
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 border border-line/60 px-2 py-0.5 rounded">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-100 group-hover:text-signal transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    {item.body}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-line/40 flex items-center text-[10px] font-mono text-signal">
                  <span>AIR-GAPPED COMPATIBLE</span>
                  <Icon icon={Zap} size={12} className="ml-1 text-signal" />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Air-gapped Architecture Details */}
        <section id="architecture" className="mt-20 scroll-mt-24">
          <div className="text-center mb-10">
            <div className="eyebrow mb-2">Defense-in-depth</div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">Air-Gapped By Design</h2>
            <p className="mt-2 text-sm text-slate-400">Strict architectural guarantees for complete data sovereignty.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-lg border border-line bg-panel/60 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-signal">
                <Icon icon={Shield} size={18} /> Compute & Inference Stack
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>NVIDIA L40S / A100</strong> hardware acceleration with quantized weights</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>Local LLM Runtime:</strong> vLLM / llama.cpp on internal unix sockets</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>Encrypted Storage:</strong> Model weights and vector indexes stored locally</span>
                </li>
              </ul>
            </article>

            <article className="rounded-lg border border-line bg-panel/60 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-signal">
                <Icon icon={Lock} size={18} /> Data Governance & Security
              </h3>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>Zero Telemetry:</strong> No external pingbacks, analytics, or licensing calls</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>Two-Person Verification:</strong> High-risk tasks require supervisor approval</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-signal" />
                  <span><strong>Cryptographic Audit:</strong> Immutable audit trail of every model execution</span>
                </li>
              </ul>
            </article>
          </div>
        </section>

        {/* Technical FAQ */}
        <section id="faq" className="mx-auto mt-20 max-w-[840px] scroll-mt-24">
          <h2 className="mb-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">Technical FAQ</h2>
          <div className="space-y-3">
            {faq.map((item) => (
              <article key={item.question} className="rounded-lg border border-line bg-panel/50 p-4 transition-colors hover:border-signal/30">
                <h3 className="font-medium text-slate-100 text-sm">{item.question}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="mt-20 rounded-xl border border-signal/30 bg-gradient-to-b from-panel/90 to-panel/40 px-6 py-14 text-center shadow-panel sm:px-12">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-signal/40 bg-signal-dim/50 text-signal shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <Icon icon={Cpu} size={22} />
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">Ready to deploy Sovereign AI?</h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-slate-300">
            Launch the workbench directly or review the complete on-premise architecture specifications.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={onEnter}
              className="rounded bg-signal px-7 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-action shadow-[0_0_20px_rgba(249,115,22,0.35)] hover:bg-orange-600 transition-all"
            >
              Launch Workbench
            </button>
            <button
              onClick={onLogin}
              className="rounded border border-signal/50 bg-signal/10 px-7 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-signal hover:bg-signal/20 transition-all"
            >
              Operator Sign In
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-line/60 bg-ink/90 py-8 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
        Built for MRPL | Smart India Hackathon 2026 · Confidential & Air-Gapped
      </footer>
    </div>
  )
}