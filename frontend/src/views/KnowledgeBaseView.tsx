import { useEffect, useState } from 'react'
import {
  BookOpen,
  FileText,
  FolderOpen,
  Search,
  UploadCloud,
  ChevronRight,
  Hash,
  Trash2,
  RefreshCw,
  Sparkles,
  Filter,
  Info,
} from 'lucide-react'
import { Icon } from '../components/ui/Icon'
import { fetchTasks } from '../lib/api'
import { getAuthHeaders, getUser } from '../lib/auth'
import { hasPermission } from '../lib/permissions'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

interface DocInfo {
  id: number
  filename: string
  file_type: string
  size_bytes: number
  indexed: string
  chunks_indexed: number
  failure_reason: string | null
  upload_date: string | null
}

interface SearchMatch {
  id: string
  excerpt: string
  relevanceScore: number
  filename: string
  doc_id?: string
  chunk: number
}

function inferDocMeta(d: DocInfo) {
  const ext = (d.file_type || d.filename.split('.').pop() || '').toLowerCase()
  const typeLabel = ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'DOCX' : ext === 'xlsx' ? 'XLSX' : ext.toUpperCase()
  const name = d.filename
  const kb = d.size_bytes ? Math.round(d.size_bytes / 1024) : 0
  const indexed = d.indexed === 'indexed'
  return { typeLabel, name, kb, indexed, raw: d }
}

export function KnowledgeBaseView() {
  const [docs, setDocs] = useState<DocInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'pending' | 'failed'>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [queries, setQueries] = useState<Record<number, string>>({})
  const [matches, setMatches] = useState<Record<number, SearchMatch[]>>({})
  const [globalContentMatches, setGlobalContentMatches] = useState<Record<string, SearchMatch>>({})
  const [searchingGlobal, setSearchingGlobal] = useState(false)
  const [searchingDoc, setSearchingDoc] = useState<number | null>(null)
  const [reindexingDoc, setReindexingDoc] = useState<number | null>(null)
  const [approverQueue, setApproverQueue] = useState(false)
  const isAdmin = hasPermission((getUser()?.role as any) || 'engineer', 'knowledge:delete')

  async function load(clearError = true) {
    setLoading(true)
    if (clearError) setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Knowledge base unavailable')
      const data = (await res.json()) as { documents: DocInfo[] }
      setDocs(data.documents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load knowledge base')
    } finally {
      setLoading(false)
    }
    try {
      const tasks = await fetchTasks(false)
      const hasPending = tasks.some((t) => t.status === 'pending_approval')
      setApproverQueue(hasPending)
      void hasPending
    } catch { /* best effort */ }
  }

  useEffect(() => { void load() }, [])

  // Global vector search when top search input changes
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setGlobalContentMatches({})
      return
    }
    const timer = setTimeout(async () => {
      setSearchingGlobal(true)
      try {
        const res = await fetch(`${API_BASE_URL}/documents/search?query=${encodeURIComponent(q)}`, {
          headers: getAuthHeaders(),
        })
        if (res.ok) {
          const data = (await res.json()) as { matches?: SearchMatch[] }
          const map: Record<string, SearchMatch> = {}
          for (const m of data.matches || []) {
            const key = m.doc_id || m.filename
            if (!map[key] || m.relevanceScore > map[key].relevanceScore) {
              map[key] = m
            }
          }
          setGlobalContentMatches(map)
        }
      } catch {
        /* silent fallback to text filtering */
      } finally {
        setSearchingGlobal(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeaders() as Record<string, string>,
        body: fd,
      })
      const data = (await res.json()) as {
        status?: string; existing_doc_id?: number; filename?: string; failure_reason?: string | null
      }
      if (!res.ok) throw new Error(data.failure_reason || 'Upload failed')
      if (data.status === 'duplicate') {
        setNotice(`Already in the Knowledge Base as document #${data.existing_doc_id}: ${data.filename}`)
      } else if (data.status === 'failed') {
        setError(data.failure_reason || 'The file was saved, but text extraction or indexing failed.')
      } else {
        setNotice(`${data.filename || file.name} was indexed and is now available to workspace retrieval.`)
      }
      await load(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSearchWithin(docId: number) {
    const query = (queries[docId] || '').trim()
    if (query.length < 2) {
      setError('Enter at least 2 characters to search within this document.')
      return
    }
    setSearchingDoc(docId)
    setError('')
    try {
      const params = new URLSearchParams({ query })
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/search?${params}`, { headers: getAuthHeaders() })
      const data = (await res.json()) as { matches?: SearchMatch[]; detail?: string }
      if (!res.ok) throw new Error(data.detail || 'Document search failed')
      setMatches((previous) => ({ ...previous, [docId]: data.matches || [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document search failed')
    } finally {
      setSearchingDoc(null)
    }
  }

  async function handleReindex(docId: number) {
    setReindexingDoc(docId)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/reindex`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = (await res.json()) as { status?: string; failure_reason?: string | null; detail?: string }
      if (!res.ok) throw new Error(data.detail || 'Re-index failed')
      if (data.status === 'indexed') setNotice('Document indexed successfully.')
      else setError(data.failure_reason || 'Text extraction or indexing failed.')
      await load(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-index failed')
    } finally {
      setReindexingDoc(null)
    }
  }

  async function handleDelete(docId: number) {
    try {
      const res = await fetch(`${API_BASE_URL}/knowledge-base/${docId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Delete failed')
      setDocs((prev) => prev.filter((d) => d.id !== docId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // Determine match reasons for each document
  function getMatchReason(d: DocInfo): { matched: boolean; reason?: 'filename' | 'type' | 'status' | 'id' | 'content'; contentMatch?: SearchMatch } {
    if (statusFilter !== 'all') {
      if (statusFilter === 'indexed' && d.indexed !== 'indexed') return { matched: false }
      if (statusFilter === 'pending' && d.indexed !== 'pending' && d.indexed !== 'processing') return { matched: false }
      if (statusFilter === 'failed' && d.indexed !== 'failed' && d.indexed !== 'duplicate') return { matched: false }
    }

    const q = search.trim().toLowerCase()
    if (!q) return { matched: true }

    // 1. Filename match
    if (d.filename.toLowerCase().includes(q)) {
      return { matched: true, reason: 'filename' }
    }
    // 2. ID match
    if (`#${d.id}` === q || String(d.id) === q.replace('#', '')) {
      return { matched: true, reason: 'id' }
    }
    // 3. File type match
    const typeLabel = inferDocMeta(d).typeLabel.toLowerCase()
    if (typeLabel === q || (d.file_type || '').toLowerCase() === q) {
      return { matched: true, reason: 'type' }
    }
    // 4. Status match
    if (d.indexed.toLowerCase() === q) {
      return { matched: true, reason: 'status' }
    }
    // 5. Global RAG Vector Content match
    const contentMatch = globalContentMatches[String(d.id)] || globalContentMatches[d.filename]
    if (contentMatch) {
      return { matched: true, reason: 'content', contentMatch }
    }

    return { matched: false }
  }

  const evaluatedDocs = docs.map((d) => ({ doc: d, ...getMatchReason(d) }))
  const filtered = evaluatedDocs.filter((item) => item.matched)

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">Local document index</div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">Knowledge Base</h2>
            <p className="mt-1 max-w-xl text-xs text-muted">
              Organizational SOPs, manuals, and references — indexed locally for private RAG retrieval.
            </p>
          </div>
          <label className="flex items-center gap-2 border border-signal/35 bg-signal-dim/35 px-4 py-2 text-xs font-semibold text-signal hover:bg-signal-dim transition-colors cursor-pointer shrink-0">
            <Icon icon={UploadCloud} size={14} />
            {uploading ? 'Uploading…' : 'Upload Document'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {error && (
          <div className="border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => load()} className="underline">
              Retry
            </button>
          </div>
        )}

        {notice && (
          <div className="border border-signal/25 bg-signal/10 px-4 py-3 text-xs text-signal">
            {notice}
          </div>
        )}

        {/* Search Controls & Filters */}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <label className="flex flex-1 items-center gap-2 border border-line bg-ink/30 px-3 py-2 text-xs text-muted focus-within:border-signal/50">
              <Icon icon={Search} size={13} className={searchingGlobal ? 'animate-pulse text-signal' : ''} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by filename, file type, ID, or RAG content keyword (e.g., 'pressure drop', 'SOP-204')..."
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="font-mono text-[10px] text-muted hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </label>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon icon={Filter} size={12} className="text-muted" />
              {(['all', 'indexed', 'pending', 'failed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded border px-2.5 py-1 font-mono text-[9px] uppercase transition-colors ${
                    statusFilter === st
                      ? 'border-signal/40 bg-signal/12 text-signal font-bold'
                      : 'border-line bg-panel/40 text-muted hover:border-signal/20'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Basis of Search Info Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-line/40 bg-panel/20 px-3 py-1.5 font-mono text-[9px] text-muted">
            <div className="flex items-center gap-1.5">
              <Icon icon={Info} size={11} className="text-signal" />
              <span>
                {search.trim()
                  ? `Active query basis: Filename, File Extension (${search.trim()}), Status, & Vector Chunk Content Similarity`
                  : 'Search basis: Filename, File Type, Status (#ID), and RAG Vector Content Similarity'}
              </span>
            </div>
            {search.trim() && (
              <span className="text-signal font-semibold">
                {filtered.length} of {docs.length} documents match
              </span>
            )}
          </div>
        </div>

        {/* Document List Grid */}
        {loading ? (
          <div className="border border-line bg-panel/30 p-8 text-center text-xs text-slate-500">
            Loading knowledge base…
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-line/60 bg-panel/20 p-8 text-center space-y-2">
            <div className="text-xs text-slate-400">
              {docs.length === 0
                ? 'No documents indexed yet — upload a PDF or document above.'
                : `No documents match "${search}" with status "${statusFilter}".`}
            </div>
            {search && (
              <div className="text-[10px] text-muted font-mono">
                Tip: Try searching broader terms or clearing the status filter.
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map(({ doc: d, reason, contentMatch }) => {
              const m = inferDocMeta(d)
              const expanded = selected === d.id
              const failed = d.indexed === 'failed'

              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(expanded ? null : d.id)}
                  className={`cursor-pointer border bg-panel/50 transition-all hover:bg-panel ${
                    expanded ? 'border-signal/40 bg-panel shadow-sm' : 'border-line'
                  }`}
                >
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center border ${
                        m.indexed
                          ? 'border-signal/25 bg-signal-dim/30 text-signal'
                          : 'border-line bg-ink/30 text-muted'
                      }`}
                    >
                      <Icon icon={m.typeLabel === 'XLSX' ? FolderOpen : FileText} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-100 truncate">{m.name}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                            <span>{m.typeLabel} · {(d.file_type || 'unknown').toLowerCase()}</span>
                            <span className="text-slate-700">·</span>
                            <span className="font-mono text-slate-500">#{d.id}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase shrink-0 ${
                            m.indexed
                              ? 'border-signal/30 bg-signal/8 text-signal'
                              : failed
                              ? 'border-danger/30 bg-danger/8 text-danger'
                              : 'border-line text-muted'
                          }`}
                        >
                          {m.indexed ? 'Indexed ✓' : d.indexed || 'Pending'}
                        </span>
                      </div>

                      {/* Match reason badge when searching */}
                      {search.trim() && reason && (
                        <div className="mt-2 flex items-center gap-1.5">
                          {reason === 'content' && contentMatch ? (
                            <span className="flex items-center gap-1 rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-signal">
                              <Icon icon={Sparkles} size={9} />
                              Content Match ({Math.round(contentMatch.relevanceScore * 100)}% RAG)
                            </span>
                          ) : (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-amber-400">
                              {reason} match
                            </span>
                          )}
                        </div>
                      )}

                      {/* Content snippet preview on card if matched by RAG content */}
                      {search.trim() && reason === 'content' && contentMatch && (
                        <div className="mt-2 rounded border border-signal/20 bg-ink/40 p-2 text-[9.5px] leading-relaxed text-slate-300 font-mono italic truncate">
                          "{contentMatch.excerpt}"
                        </div>
                      )}

                      <div className="mt-2 font-mono text-[9px] text-slate-600 flex gap-3">
                        <span>{m.kb} KB</span>
                        {d.upload_date && <span>{new Date(d.upload_date).toLocaleDateString('en-IN')}</span>}
                      </div>
                    </div>
                    <Icon
                      icon={ChevronRight}
                      size={13}
                      className={`shrink-0 transition-transform ${
                        expanded ? 'rotate-90 text-signal' : 'text-slate-700'
                      }`}
                    />
                  </div>

                  {/* Expanded Card details */}
                  {expanded && (
                    <div className="border-t border-line/50 bg-ink/20 p-4 space-y-3 text-[10px]">
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] uppercase tracking-wider text-slate-600">Document ID</span>
                          <span className="text-slate-300">#{d.id}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] uppercase tracking-wider text-slate-600">Indexed Chunks</span>
                          <span className="text-slate-300">
                            {m.indexed ? `${d.chunks_indexed || 0} chunks (ChromaDB)` : d.indexed}
                          </span>
                        </div>
                      </div>

                      {d.failure_reason && (
                        <div className="border border-danger/20 bg-danger/5 px-2.5 py-2 text-[9px] leading-relaxed text-danger">
                          {d.failure_reason}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        {m.indexed && (
                          <span className="flex items-center gap-1.5 text-[9px] text-muted">
                            <Icon icon={Hash} size={10} /> Search vector chunks within this document below
                          </span>
                        )}
                        {isAdmin && !m.indexed && d.indexed !== 'duplicate' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleReindex(d.id)
                            }}
                            disabled={reindexingDoc === d.id}
                            className="flex items-center gap-1.5 border border-signal/30 px-2.5 py-1 text-[9px] text-signal hover:bg-signal/10 disabled:opacity-50 transition-colors"
                          >
                            <Icon icon={RefreshCw} size={10} className={reindexingDoc === d.id ? 'animate-spin' : ''} />
                            {reindexingDoc === d.id ? 'Indexing…' : 'Retry indexing'}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDelete(d.id)
                            }}
                            className="flex items-center gap-1.5 border border-danger/30 px-2.5 py-1 text-[9px] text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Icon icon={Trash2} size={10} />
                            Delete
                          </button>
                        )}
                      </div>

                      {/* Search within document */}
                      {m.indexed && (
                        <div onClick={(e) => e.stopPropagation()} className="space-y-2 border-t border-line/40 pt-3">
                          <div className="flex gap-2">
                            <input
                              value={queries[d.id] || ''}
                              onChange={(e) =>
                                setQueries((previous) => ({ ...previous, [d.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleSearchWithin(d.id)
                              }}
                              placeholder="Find a specific clause, number, or keyword in this document…"
                              className="min-w-0 flex-1 border border-line bg-ink/50 px-2.5 py-1.5 text-[10px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-signal/50"
                            />
                            <button
                              onClick={() => void handleSearchWithin(d.id)}
                              disabled={searchingDoc === d.id}
                              className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[9px] text-muted hover:border-signal/40 hover:text-signal disabled:opacity-50"
                            >
                              <Icon icon={Search} size={10} />
                              {searchingDoc === d.id ? 'Searching…' : 'Search'}
                            </button>
                          </div>

                          {matches[d.id] && (
                            <div className="space-y-2">
                              {matches[d.id].length === 0 ? (
                                <div className="text-[9px] text-slate-500">
                                  No matching chunks found in this document.
                                </div>
                              ) : (
                                matches[d.id].map((match) => (
                                  <div key={match.id} className="border border-line/60 bg-panel/40 p-2.5">
                                    <div className="mb-1 font-mono text-[8px] uppercase tracking-wider text-signal flex items-center justify-between">
                                      <span>Chunk {match.chunk + 1}</span>
                                      <span>{Math.round(match.relevanceScore * 100)}% relevance score</span>
                                    </div>
                                    <div className="whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300 font-mono">
                                      {match.excerpt}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border border-line bg-panel/30 px-5 py-3 text-[10px]">
          <div className="flex items-center gap-3">
            <Icon icon={BookOpen} size={13} className="text-signal" />
            <span className="text-muted">
              {docs.filter((d) => d.indexed === 'indexed').length} documents indexed locally
            </span>
            <span className="text-slate-700">·</span>
            <span className="font-mono text-muted">{docs.length} total</span>
          </div>
          <div className="font-mono text-signal text-[9px]">Vector store: ChromaDB (local)</div>
        </div>
      </div>
    </div>
  )
}
