import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2, Pencil, Archive, RefreshCw, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { Icon } from '../ui/Icon'
import type { ConversationSummary } from '../../lib/types'

function groupLabel(iso: string | null): string {
  if (!iso) return 'Older'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days < 7) return 'This week'
  if (days < 30) return 'Older'
  return 'Older'
}

interface Props {
  conversations: ConversationSummary[]
  activeId: number | null
  onSelect: (id: number) => void
  onNew?: () => void
  onRename: (id: number, title: string) => void
  onDelete: (id: number) => void
  onArchiveToggle?: (id: number, archived: boolean) => void
  onRefresh: () => void
  loading?: boolean
  search: string
  onSearchChange: (v: string) => void
  collapsed?: boolean
}

export function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onArchiveToggle,
  onRefresh,
  loading,
  search,
  onSearchChange,
  collapsed,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    if (editingId != null) {
      const c = conversations.find((x) => x.id === editingId)
      if (c) setEditTitle(c.title)
    }
  }, [editingId, conversations])

  const grouped = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This week', 'Older']
    const map = new Map<string, ConversationSummary[]>()
    for (const c of conversations) {
      const g = groupLabel(c.updated_at ?? c.created_at)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(c)
    }
    return order.filter((k) => map.has(k)).map((k) => ({ label: k, items: map.get(k)! }))
  }, [conversations])

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-b border-line bg-navy/40 px-1 py-2.5">
        <button onClick={onRefresh} className="flex size-8 items-center justify-center rounded border border-line bg-panel/40 text-muted hover:text-slate-200 transition-colors" title="Refresh conversations">
          <Icon icon={RefreshCw} size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col border-b border-line bg-navy/40">
      {/* Header with Expand/Collapse toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-line/30 bg-navy/60">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400 hover:text-slate-200 transition-colors"
          aria-label={isExpanded ? "Collapse conversations" : "Expand conversations"}
        >
          <Icon icon={isExpanded ? ChevronDown : ChevronRight} size={12} className="text-slate-400" />
          <span>Conversations</span>
          {conversations.length > 0 && (
            <span className="rounded bg-panel/80 px-1.5 py-0.2 font-mono text-[9px] text-slate-400 border border-line/50">
              {conversations.length}
            </span>
          )}
        </button>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded border border-line/50 bg-panel/50 px-2 py-0.5 text-[10px] text-muted hover:text-slate-200 transition-colors" title="Refresh">
          <Icon icon={RefreshCw} size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <>
          {/* Search bar */}
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-2 rounded border border-line/70 bg-panel/50 px-2.5 py-1">
              <Icon icon={Search} size={12} className="text-slate-500" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search history..."
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="max-h-[28vh] overflow-y-auto px-2 py-1 space-y-2">
            {loading && conversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">Loading history…</div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 border border-dashed border-line/60 bg-panel/20 px-3 py-6 text-center rounded">
                <Icon icon={MessageSquare} size={16} className="text-slate-600" />
                <div className="text-[11px] font-medium text-slate-400">No conversations</div>
                <div className="text-[10px] text-slate-500">Your chat history will appear here.</div>
              </div>
            ) : (
              grouped.map((g) => (
                <div key={g.label}>
                  <div className="px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">{g.label}</div>
                  <div className="space-y-1">
                    {g.items.map((c) => {
                      const active = c.id === activeId
                      const isEditing = editingId === c.id
                      return (
                        <div
                          key={c.id}
                          className={`group flex flex-col rounded border px-2 py-1.5 transition-colors ${
                            active
                              ? 'border-signal/40 bg-signal/10'
                              : 'border-line/40 bg-panel/30 hover:border-line hover:bg-panel/60'
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex gap-1.5">
                              <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="min-w-0 flex-1 rounded border border-signal/30 bg-ink px-2 py-0.5 text-xs text-slate-100 outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const v = editTitle.trim()
                                    if (v) onRename(c.id, v)
                                    setEditingId(null)
                                  }
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                              />
                              <button
                                onClick={() => { const v = editTitle.trim(); if (v) onRename(c.id, v); setEditingId(null) }}
                                className="rounded bg-signal px-2 py-0.5 text-[10px] font-semibold text-action"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingId(null)} className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => onSelect(c.id)} className="text-left w-full">
                                <div className={`truncate text-xs font-medium ${active ? 'text-signal' : 'text-slate-200'}`} title={c.title}>
                                  {c.title}
                                </div>
                                {c.last_message_preview ? (
                                  <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{c.last_message_preview}</div>
                                ) : (
                                  <div className="mt-0.5 text-[10px] text-slate-500">{c.message_count ?? 0} messages</div>
                                )}
                              </button>
                              <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingId(c.id)} className="flex items-center gap-1 rounded border border-line bg-ink/40 px-1.5 py-0.5 text-[9px] text-muted hover:text-slate-200" title="Rename">
                                  <Icon icon={Pencil} size={9} /> Rename
                                </button>
                                {onArchiveToggle && (
                                  <button onClick={() => onArchiveToggle(c.id, !c.archived)} className="flex items-center gap-1 rounded border border-line bg-ink/40 px-1.5 py-0.5 text-[9px] text-muted hover:text-slate-200" title={c.archived ? 'Unarchive' : 'Archive'}>
                                    <Icon icon={Archive} size={9} /> {c.archived ? 'Unarchive' : 'Archive'}
                                  </button>
                                )}
                                <button onClick={() => onDelete(c.id)} className="ml-auto flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[9px] text-danger hover:bg-danger/15" title="Delete">
                                  <Icon icon={Trash2} size={9} /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
