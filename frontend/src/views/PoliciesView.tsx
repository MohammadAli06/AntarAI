import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Icon } from '../components/ui/Icon'

interface PoliciesViewProps {
  policies: Record<string, unknown>
  loading: boolean
}

interface RiskRule { id: string; name: string; risk: string; when: string; rationale: string }

const FALLBACK: Record<string, unknown> = {
  risk_rules: [] as RiskRule[],
  approval_thresholds: { auto_approve: { enabled: true, max_risk: 'low', min_confidence: 0.9 } },
  sovereignty: { external_network: 'blocked', permitted_local_endpoints: ['127.0.0.1:8081'] },
}

const RISK_COLORS: Record<string, string> = {
  low: 'border-signal/30 text-signal bg-signal/8',
  medium: 'border-warning/30 text-warning bg-warning/8',
  high: 'border-danger/30 text-danger bg-danger/8',
  critical: 'border-danger/40 text-danger bg-danger/12',
}

export function PoliciesView({ policies, loading }: PoliciesViewProps) {
  const data = (Object.keys(policies).length > 0 ? policies : FALLBACK) as {
    risk_rules?: RiskRule[]
    approval_thresholds?: { auto_approve?: Record<string, unknown>; high_risk?: Record<string, unknown> }
    sovereignty?: Record<string, unknown>
  }
  const rules = data.risk_rules ?? []
  const thresholds = data.approval_thresholds ?? {}
  const sovereignty = data.sovereignty ?? {}

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl">
        <div>
          <div className="eyebrow mb-1">Governance</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Policies</h2>
          <p className="mt-1 text-xs text-muted">
            Risk classification rules, approval thresholds, and sovereignty enforcement — loaded from <code className="font-mono text-slate-400">policies.yaml</code>.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon icon={Loader2} size={13} className="animate-spin text-signal" />
            Loading policies…
          </div>
        )}

        {/* Risk classification rules */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={AlertTriangle} size={11} /> Risk Classification Rules
          </div>
          <div className="space-y-2">
            {rules.length === 0 && (
              <div className="border border-line bg-panel/40 px-4 py-3 text-[10px] text-muted">No rules configured.</div>
            )}
            {rules.map((r) => (
              <div key={r.id} className="border border-line bg-panel/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-slate-600">{r.id}</span>
                    <span className="text-xs font-semibold text-slate-200">{r.name}</span>
                  </div>
                  <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase ${RISK_COLORS[r.risk] ?? 'border-line text-muted'}`}>
                    {r.risk}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[9px] text-signal">{r.when}</div>
                <p className="mt-1 text-[10px] leading-4 text-muted">{r.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Approval thresholds */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={CheckCircle2} size={11} /> Approval Thresholds
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(thresholds).map(([key, val]) => (
              <div key={key} className="border border-line bg-panel/40 p-4">
                <div className="font-mono text-[9px] uppercase tracking-wider text-slate-600 mb-2">{key.replace('_', ' ')}</div>
                <div className="space-y-1">
                  {val && typeof val === 'object'
                    ? Object.entries(val as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[10px]">
                          <span className="text-muted">{k.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-slate-200">{String(v)}</span>
                        </div>
                      ))
                    : <span className="text-[10px] text-muted">{String(val)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sovereignty enforcement */}
        <div>
          <div className="eyebrow mb-3 flex items-center gap-1.5">
            <Icon icon={ShieldCheck} size={11} /> Sovereignty Enforcement
          </div>
          <div className="border border-line bg-panel/40 p-4 space-y-1.5">
            {Object.entries(sovereignty).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-muted">{k.replace(/_/g, ' ')}</span>
                <span className="font-mono text-slate-200">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
