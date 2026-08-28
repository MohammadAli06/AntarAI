import { Loader2, Users } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import type { UserInfo } from '../lib/api'
import type { UserRole } from '../lib/types'

interface UsersViewProps {
  users: UserInfo[]
  loading: boolean
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-danger/30 bg-danger/10 text-danger',
  approver: 'border-warning/30 bg-warning/10 text-warning',
  engineer: 'border-signal/30 bg-signal/10 text-signal',
}

const FALLBACK_USERS: UserInfo[] = [
  { id: 1, username: 'engineer1', role: 'engineer' },
  { id: 2, username: 'approver1', role: 'approver' },
  { id: 3, username: 'admin1', role: 'admin' },
]

export function UsersView({ users, loading }: UsersViewProps) {
  const display = users.length > 0 ? users : FALLBACK_USERS

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-4xl">
        <div>
          <div className="eyebrow mb-1">Governance</div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Users &amp; Roles</h2>
          <p className="mt-1 text-xs text-muted">
            Provisioned accounts and their server-issued roles. Role enforcement happens server-side via signed JWT + require_role().
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon icon={Loader2} size={13} className="animate-spin text-signal" />
            Loading users…
          </div>
        )}

        <div className="border border-line bg-panel/40 divide-y divide-line/40">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600 bg-ink/20">
            <div className="col-span-1">ID</div>
            <div className="col-span-5">Username</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-3">Created</div>
          </div>
          {display.map((u) => (
            <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs">
              <div className="col-span-1 font-mono text-muted">{u.id}</div>
              <div className="col-span-5 flex items-center gap-2">
                <Icon icon={Users} size={13} className="text-muted" />
                <span className="font-medium text-slate-200">{u.username}</span>
              </div>
              <div className="col-span-3">
                <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${ROLE_COLORS[u.role] ?? 'border-line text-muted'}`}>
                  {u.role as UserRole}
                </span>
              </div>
              <div className="col-span-3 font-mono text-[10px] text-muted">
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-line bg-panel/30 px-4 py-3 text-[10px] text-muted">
          Roles are bound to signed JWTs. Demo role switching re-issues a short-lived, demo-scoped token (DEMO_MODE) — it never mutates the persisted role above.
        </div>
      </div>
    </div>
  )
}
