import { useState } from 'react'
import { BookOpen, FileText, FolderOpen, Search, UploadCloud, ChevronRight, ExternalLink, Hash } from 'lucide-react'
import { Icon } from '../components/ui/Icon'

interface KnowledgeDoc {
  id: string
  name: string
  type: 'PDF' | 'XLSX' | 'DOCX'
  department: string
  docType: string
  revision: string
  revisionOwner: string
  effectiveDate: string
  sensitivity: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'
  indexed: boolean
  pages: number
  chunks: number
  usedInTasks: string[]
}

const DOCS: KnowledgeDoc[] = [
  {
    id: 'sop-pump-042',
    name: 'MRPL-SOP-PUMP-042',
    type: 'PDF',
    department: 'Maintenance',
    docType: 'Standard Operating Procedure',
    revision: '7',
    revisionOwner: 'Chief Engineer',
    effectiveDate: '2026-01-15',
    sensitivity: 'INTERNAL',
    indexed: true,
    pages: 82,
    chunks: 441,
    usedInTasks: ['TASK-1042', 'TASK-991', 'TASK-887'],
  },
  {
    id: 'cdu-maintenance',
    name: 'CDU-04 Maintenance Register',
    type: 'PDF',
    department: 'Maintenance',
    docType: 'Maintenance Record',
    revision: '12',
    revisionOwner: 'Maintenance Lead',
    effectiveDate: '2026-03-01',
    sensitivity: 'INTERNAL',
    indexed: true,
    pages: 48,
    chunks: 218,
    usedInTasks: ['TASK-1041'],
  },
  {
    id: 'hse-incident',
    name: 'HSE Incident Response SOP',
    type: 'PDF',
    department: 'HSE',
    docType: 'Standard Operating Procedure',
    revision: '5',
    revisionOwner: 'HSE Manager',
    effectiveDate: '2025-11-01',
    sensitivity: 'INTERNAL',
    indexed: true,
    pages: 34,
    chunks: 167,
    usedInTasks: [],
  },
  {
    id: 'process-safety',
    name: 'MRPL Process Safety Manual',
    type: 'PDF',
    department: 'Operations',
    docType: 'Safety Manual',
    revision: '3',
    revisionOwner: 'Safety Committee',
    effectiveDate: '2025-06-01',
    sensitivity: 'RESTRICTED',
    indexed: true,
    pages: 246,
    chunks: 1203,
    usedInTasks: ['TASK-991'],
  },
  {
    id: 'throughput-baseline',
    name: 'Refinery Throughput Baseline',
    type: 'XLSX',
    department: 'Planning',
    docType: 'Analytics Report',
    revision: '1',
    revisionOwner: 'Planning Team',
    effectiveDate: '2026-08-01',
    sensitivity: 'INTERNAL',
    indexed: false,
    pages: 0,
    chunks: 0,
    usedInTasks: [],
  },
]

const SENSITIVITY_STYLE: Record<KnowledgeDoc['sensitivity'], string> = {
  INTERNAL: 'border-muted/30 bg-panel text-muted',
  RESTRICTED: 'border-warning/30 bg-warning/8 text-warning',
  PUBLIC: 'border-signal/30 bg-signal/8 text-signal',
}

export function KnowledgeBaseView() {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null)

  const departments = ['All', ...Array.from(new Set(DOCS.map((d) => d.department)))]

  const filtered = DOCS.filter((doc) => {
    const matchSearch = search === '' || doc.name.toLowerCase().includes(search.toLowerCase()) || doc.department.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === 'All' || doc.department === deptFilter
    return matchSearch && matchDept
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow mb-1">Local document index</div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-100">Knowledge Base</h2>
            <p className="mt-1 max-w-xl text-xs text-muted">
              Organizational SOPs, manuals, and references — indexed locally for private knowledge retrieval.
            </p>
          </div>
          <button className="flex items-center gap-2 border border-signal/35 bg-signal-dim/35 px-4 py-2 text-xs font-semibold text-signal hover:bg-signal-dim transition-colors">
            <Icon icon={UploadCloud} size={14} />
            Upload Document
          </button>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 border border-line bg-ink/30 px-3 py-2 text-xs text-muted focus-within:border-signal/50">
            <Icon icon={Search} size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizational knowledge…"
              className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="flex gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`border px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-wider transition-colors ${
                  deptFilter === dept
                    ? 'border-signal/40 bg-signal/10 text-signal'
                    : 'border-line text-muted hover:border-line/80 hover:text-slate-300'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Document grid */}
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
              className={`cursor-pointer border bg-panel/50 transition-all hover:bg-panel ${
                selectedDoc?.id === doc.id ? 'border-signal/40 bg-panel' : 'border-line'
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                <div className={`flex size-9 shrink-0 items-center justify-center border text-signal ${doc.indexed ? 'border-signal/25 bg-signal-dim/30' : 'border-line bg-ink/30 text-muted'}`}>
                  <Icon icon={doc.type === 'XLSX' ? FolderOpen : FileText} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-100">{doc.name}</div>
                      <div className="mt-0.5 text-[10px] text-muted">{doc.docType}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase ${SENSITIVITY_STYLE[doc.sensitivity]}`}>
                        {doc.sensitivity}
                      </span>
                      <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase ${doc.indexed ? 'border-signal/30 bg-signal/8 text-signal' : 'border-line text-muted'}`}>
                        {doc.indexed ? 'Indexed ✓' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 font-mono text-[9px] text-slate-600">
                    <span>Rev. {doc.revision}</span>
                    <span>Dept: {doc.department}</span>
                    {doc.indexed && <span>{doc.pages} pages · {doc.chunks.toLocaleString()} chunks</span>}
                  </div>
                </div>
                <Icon icon={ChevronRight} size={13} className={`shrink-0 transition-transform ${selectedDoc?.id === doc.id ? 'rotate-90 text-signal' : 'text-slate-700'}`} />
              </div>

              {/* Expanded metadata */}
              {selectedDoc?.id === doc.id && (
                <div className="border-t border-line/50 bg-ink/20 p-4 space-y-3 text-[10px]">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Revision Owner', doc.revisionOwner],
                      ['Effective Date', doc.effectiveDate],
                      ['Document Type', doc.docType],
                      ['Indexed Chunks', doc.chunks.toLocaleString()],
                    ].map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-0.5">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{k}</span>
                        <span className="text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>

                  {doc.usedInTasks.length > 0 && (
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600 mb-1.5">
                        Used in Tasks
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {doc.usedInTasks.map((t) => (
                          <span key={t} className="border border-signal/25 bg-signal/8 px-1.5 py-0.5 font-mono text-[9px] text-signal">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[9px] text-muted hover:border-signal/40 hover:text-signal transition-colors">
                      <Icon icon={ExternalLink} size={10} />
                      Open
                    </button>
                    <button className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[9px] text-muted hover:border-signal/40 hover:text-signal transition-colors">
                      <Icon icon={Search} size={10} />
                      Search Within
                    </button>
                    <button className="flex items-center gap-1.5 border border-line px-2.5 py-1 text-[9px] text-muted hover:border-signal/40 hover:text-signal transition-colors">
                      <Icon icon={Hash} size={10} />
                      View Chunks
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Index stats footer */}
        <div className="flex items-center justify-between border border-line bg-panel/30 px-5 py-3 text-[10px]">
          <div className="flex items-center gap-3">
            <Icon icon={BookOpen} size={13} className="text-signal" />
            <span className="text-muted">{DOCS.filter((d) => d.indexed).length} documents indexed locally</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono text-muted">{DOCS.reduce((a, d) => a + d.chunks, 0).toLocaleString()} total chunks</span>
          </div>
          <div className="font-mono text-signal text-[9px]">Vector store: localhost:9000</div>
        </div>
      </div>
    </div>
  )
}
