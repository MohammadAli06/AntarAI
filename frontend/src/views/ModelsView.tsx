import { Cpu, ExternalLink, Server } from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import { EmptyState } from '../components/ui/EmptyState'
import { Panel } from '../components/ui/Panel'
import { StatusBadge } from '../components/ui/StatusBadge'
import { getRoleLabel, getStatusLabel } from '../lib/utils'
import type { ModelInfo } from '../lib/types'

interface ModelsViewProps { models: ModelInfo[]; loading: boolean; error?: string }

export function ModelsView({ models, loading, error }: ModelsViewProps) {
  return <div className="space-y-6 panel-enter">
    <div><div className="eyebrow mb-2">Model registry</div><h2 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">Registered models</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-muted sm:text-sm">Every task is routed to a local model role through the workbench registry.</p></div>
    <Panel className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><div className="eyebrow mb-1">Local inference stack</div><h3 className="section-title">Available models <span className="ml-1 font-mono text-[10px] font-normal text-muted">/ {models.length}</span></h3></div><StatusBadge tone="success" compact>{loading ? 'Syncing' : 'Registry loaded'}</StatusBadge></div>{error ? <div className="px-5 py-10 text-center text-xs text-danger">{error}</div> : models.length === 0 && !loading ? <EmptyState title="No models registered" description="Add a model to the local registry to make it available for task routing." /> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead className="border-b border-line bg-ink/20"><tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted"><th className="px-5 py-3 font-medium">Model</th><th className="px-5 py-3 font-medium">Role</th><th className="px-5 py-3 font-medium">Endpoint</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-line/70">{models.map((model) => <tr key={`${model.role}-${model.name}`} className="transition-colors hover:bg-raised/20"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center border border-line bg-ink/35 text-signal"><Icon icon={Cpu} size={15} /></span><div><div className="text-xs font-medium text-slate-200">{model.name}</div><div className="mt-1 text-[10px] text-muted">{model.description || 'Local open-weight model'}</div></div></div></td><td className="px-5 py-4"><span className="text-xs text-slate-300">{getRoleLabel(model.role)}</span></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted"><Icon icon={Server} size={12} />{model.endpoint || 'localhost'}</span></td><td className="px-5 py-4"><StatusBadge tone={model.status.toLowerCase() === 'offline' ? 'danger' : model.status.toLowerCase() === 'mock' ? 'neutral' : 'success'} compact>{getStatusLabel(model.status)}</StatusBadge></td></tr>)}</tbody></table></div>}</Panel>
    <div className="flex items-center gap-2 border border-line bg-panel/35 px-4 py-3 text-[10px] text-muted"><Icon icon={ExternalLink} size={13} className="text-signal" />Model endpoints are expected to resolve within the air-gapped network.</div>
  </div>
}
