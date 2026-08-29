import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, UserSquare2 } from 'lucide-react'
import { useState } from 'react'
import { login as apiLogin } from '../lib/api'
import { setToken, setUser } from '../lib/auth'
import { Icon } from '../components/ui/Icon'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import type { Theme } from '../lib/types'

interface AuthPageProps {
  theme: Theme
  onToggleTheme: () => void
  onAuthenticate: () => void
  onBackHome: () => void
}

export function AuthPage({ theme, onToggleTheme, onAuthenticate, onBackHome }: AuthPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="landing-shell flex min-h-screen w-full flex-col overflow-y-auto text-slate-100 selection:bg-signal selection:text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
        <button onClick={onBackHome} className="flex items-center gap-2.5 text-left">
          <span className="flex size-8 items-center justify-center rounded border border-signal/40 bg-signal-dim/60 text-signal shadow-[0_0_14px_rgba(249,115,22,0.25)]">
            <Icon icon={ShieldCheck} size={17} />
          </span>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-100">AntarAI</span>
            <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500 hidden sm:inline">
              Sovereign Auth
            </span>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onBackHome}
            className="text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-signal transition-colors hidden sm:block mr-2"
          >
            ← Back to Home
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
        </div>
      </header>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-8">
        <section className="w-full max-w-[440px] rounded-xl border border-line bg-panel/80 p-7 shadow-panel backdrop-blur-md sm:p-8">
          {/* Lock icon + title */}
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-signal/40 bg-signal-dim/50 text-signal shadow-[0_0_28px_rgba(249,115,22,0.3)]">
              <Icon icon={Lock} size={22} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Sovereign AI Access</h1>
            <p className="mt-2 text-xs text-muted">Confidential on-premise authentication portal</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              <Icon icon={AlertCircle} size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Operator Username</span>
              <span className="flex h-11 items-center gap-2 rounded border border-line bg-ink/60 px-3 text-slate-300 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal/30 transition-all">
                <Icon icon={UserSquare2} size={15} className="shrink-0 text-slate-500" />
                <input
                  id="auth-username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(null) }}
                  placeholder="e.g. engineer1, admin, approver1"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-600"
                  disabled={loading}
                />
              </span>
            </label>

            {/* Password */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Password</span>
              <span className="flex h-11 items-center gap-2 rounded border border-line bg-ink/60 px-3 text-slate-300 focus-within:border-signal focus-within:ring-1 focus-within:ring-signal/30 transition-all">
                <Icon icon={KeyRound} size={15} className="shrink-0 text-slate-500" />
                <input
                  id="auth-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••••"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-600"
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
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-signal px-5 text-xs font-semibold uppercase tracking-[0.1em] text-action shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:bg-orange-600 hover:shadow-[0_0_28px_rgba(249,115,22,0.45)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Icon icon={Loader2} size={15} className="animate-spin" /> Verifying Credentials…</>
                : 'Sign In to Workbench'
              }
            </button>
          </form>

          {/* Trust indicators */}
          <div className="mt-6 border-t border-line/60 pt-5 space-y-1.5 text-[11px] text-slate-500">
            <p className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-signal" />
              Air-gapped verification — zero outbound telemetrics
            </p>
            <p className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-signal" />
              Encrypted local session token
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/60 bg-ink/90 py-6 text-center text-[10px] uppercase tracking-[0.2em] text-slate-500">
        Built for MRPL | Smart India Hackathon 2026
      </footer>
    </div>
  )
}