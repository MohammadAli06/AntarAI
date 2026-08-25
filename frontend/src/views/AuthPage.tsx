import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, UserSquare2 } from 'lucide-react'
import { useState } from 'react'
import { login as apiLogin } from '../lib/api'
import { setToken, setUser } from '../lib/auth'
import { Icon } from '../components/ui/Icon'

interface AuthPageProps {
  onAuthenticate: () => void
  onBackHome: () => void
}

export function AuthPage({ onAuthenticate, onBackHome }: AuthPageProps) {
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await apiLogin(username.trim(), password)
      setToken(result.access_token)
      setUser({ username: result.username, role: result.role })
      onAuthenticate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-shell flex min-h-screen flex-col text-slate-100">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <button onClick={onBackHome} className="flex items-center gap-2 text-[28px] font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded border border-signal/30 bg-signal-dim/50 text-signal">
            <Icon icon={ShieldCheck} size={16} />
          </span>
          <span className="text-xl">Sovereign AI Workbench</span>
        </button>
        <nav className="hidden items-center gap-8 text-xs text-slate-300 md:flex">
          <button onClick={onBackHome} className="text-signal">Home</button>
          <button>Capabilities</button>
          <button>Documentation</button>
        </nav>
      </header>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-5 pb-14 pt-8 sm:px-8">
        <section className="w-full max-w-[420px] rounded-xl border border-line bg-panel/70 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:p-8">

          {/* Lock icon + title */}
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-signal/40 bg-signal-dim/30 text-signal shadow-[0_0_24px_rgba(100,220,210,0.15)]">
              <Icon icon={Lock} size={20} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Sovereign AI Workbench</h1>
            <p className="mt-2 text-[13px] text-slate-400">Secure access · on-premise authentication</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
              <Icon icon={AlertCircle} size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Username</span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-line bg-ink/45 px-3 text-slate-300 focus-within:border-signal/60 transition-colors">
                <Icon icon={UserSquare2} size={14} className="shrink-0 text-slate-500" />
                <input
                  id="auth-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(null) }}
                  placeholder="engineer1"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                  disabled={loading}
                />
              </span>
            </label>

            {/* Password */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Password</span>
              <span className="flex h-11 items-center gap-2 rounded-lg border border-line bg-ink/45 px-3 text-slate-300 focus-within:border-signal/60 transition-colors">
                <Icon icon={KeyRound} size={14} className="shrink-0 text-slate-500" />
                <input
                  id="auth-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  <Icon icon={showPass ? EyeOff : Eye} size={14} />
                </button>
              </span>
            </label>

            {/* Submit */}
            <button
              id="auth-sign-in"
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal px-5 text-sm font-semibold text-ink transition-all hover:bg-[#79e8d9] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Icon icon={Loader2} size={15} className="animate-spin" /> Authenticating…</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Trust indicators */}
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="size-1.5 rounded-full bg-signal" />
              Encrypted local session
            </p>
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="size-1.5 rounded-full bg-signal" />
              Air-gapped verification — zero external calls
            </p>
            <p className="mt-4 text-center text-[11px] text-slate-600">
              Access restricted to authorized personnel
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/60 bg-[#081221] py-8 text-center text-[11px] uppercase tracking-[0.2em] text-slate-500">
        Built for MRPL | Smart India Hackathon 2026
      </footer>
    </div>
  )
}