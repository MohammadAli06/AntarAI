import type {
  ChatResponse,
  ModelInfo,
  OutputFile,
  SovereigntyStatus,
  UploadType,
} from './types'
import { getAuthHeaders, handleUnauthorized } from './auth'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

interface RawChatResponse {
  response?: string
  model_used?: string
  modelUsed?: string
  steps?: string[]
  generated_file?: string
  generatedFile?: string
}

interface RawOutput {
  name?: string
  filename?: string
  type?: string
  size_bytes?: number
  sizeBytes?: number
  url?: string
  download_url?: string
}

interface RawModel {
  name?: string
  role?: string
  status?: string
  description?: string
  endpoint?: string
  format?: string
  quantization?: string
  vram_gb?: number
  context_tokens?: number
  model_path?: string
  architecture?: string
  parameter_count?: string
  file_size_bytes?: number
  tensor_count?: number
  model_context_tokens?: number
  estimated_vram_gb?: number
  runtime_context_tokens?: number
  load_policy?: string
  priority?: number
  gpu_node?: string
  enabled?: boolean
  gpu_name?: string | null
  gpu_vram_gb?: number | null
  metadata_status?: string
  inspection_error?: string | null
  capabilities?: string[]
  active?: boolean
}

interface RawSovereigntyStatus {
  external_calls?: number
  externalCalls?: number
  local_model_calls?: number
  localModelCalls?: number
  local_files_accessed?: number
  localFilesAccessed?: number
  blocked_attempts?: number
  blockedAttempts?: number
  online?: boolean
  verdict?: string
  local_services?: { port: number; name: string; address: string; online?: boolean }[]
  localServices?: { port: number; name: string; address: string; online?: boolean }[]
  model_integrity?: { modelFile: string; sha256: string; verified: boolean }[]
  modelIntegrity?: { modelFile: string; sha256: string; verified: boolean }[]
}

// ---------------------------------------------------------------------------
// Core request helper — attaches JWT, handles 401 globally
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  // Global 401 handler — clear token and redirect to login
  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again.')
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Auth — login
// ---------------------------------------------------------------------------

export interface LoginResult {
  access_token: string
  token_type: string
  username: string
  role: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    let detail = 'Invalid username or password'
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch { /* empty */ }
    throw new Error(detail)
  }

  return response.json() as Promise<LoginResult>
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function inferRole(modelName: string): string {
  const name = modelName.toLowerCase()
  if (name.includes('coder') || name.includes('code')) return 'coder'
  if (name.includes('vision') || name.includes('vl')) return 'vision'
  return 'general'
}

function inferOutputType(name: string, explicitType?: string): string {
  if (explicitType) return explicitType
  const extension = name.split('.').pop()?.toLowerCase()
  if (extension === 'docx' || extension === 'doc') return 'Word document'
  if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') return 'Spreadsheet'
  if (extension === 'pptx' || extension === 'ppt') return 'Presentation'
  if (extension === 'py' || extension === 'js' || extension === 'ts' || extension === 'json') return 'Code'
  return extension ? extension.toUpperCase() : 'File'
}

function normalizeOutput(output: RawOutput): OutputFile {
  const name = output.name || output.filename || 'Generated file'
  return {
    name,
    type: inferOutputType(name, output.type),
    sizeBytes: output.size_bytes ?? output.sizeBytes,
    url: resolveUrl(output.url || output.download_url || `/outputs/${encodeURIComponent(name)}`),
  }
}

export function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function sendChat(message: string, file?: File): Promise<ChatResponse> {
  const formData = new FormData()
  formData.append('message', message)
  if (file) formData.append('file', file)

  const raw = await request<RawChatResponse>('/chat', {
    method: 'POST',
    body: formData,
  })
  const modelUsed = raw.model_used || raw.modelUsed || 'Local model'
  return {
    response: raw.response || '',
    modelUsed,
    role: inferRole(modelUsed),
    steps: raw.steps || [],
    generatedFile: raw.generated_file || raw.generatedFile,
  }
}

export async function uploadFile(file: File): Promise<{ filename: string; type: UploadType }> {
  const formData = new FormData()
  formData.append('file', file)
  const raw = await request<{ filename?: string; type?: UploadType }>('/upload', {
    method: 'POST',
    body: formData,
  })
  return {
    filename: raw.filename || file.name,
    type: raw.type || (file.type === 'application/pdf' ? 'pdf' : 'image'),
  }
}

export async function fetchOutputs(): Promise<OutputFile[]> {
  const raw = await request<{ files?: RawOutput[]; outputs?: RawOutput[] }>('/outputs')
  return (raw.files || raw.outputs || []).map(normalizeOutput)
}

export async function fetchArtifactPreview(filename: string): Promise<string> {
  const raw = await request<{ content?: string }>(`/outputs/${encodeURIComponent(filename)}/preview`)
  return raw.content || ''
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const raw = await request<{ models?: RawModel[] }>('/models')
  return (raw.models || []).map((model) => ({
    name: model.name || 'Unnamed model',
    role: model.role || 'general',
    status: model.status || 'unknown',
    description: model.description,
    endpoint: model.endpoint,
    active: model.active ?? false,
    format: model.format,
    quantization: model.quantization,
    vramGb: model.vram_gb,
    contextLength: model.context_tokens,
    capabilities: model.capabilities,
    modelPath: model.model_path,
    architecture: model.architecture,
    parameterCount: model.parameter_count,
    fileSizeBytes: model.file_size_bytes,
    tensorCount: model.tensor_count,
    modelContextLength: model.model_context_tokens,
    estimatedVramGb: model.estimated_vram_gb,
    runtimeContextLength: model.runtime_context_tokens,
    loadPolicy: model.load_policy,
    priority: model.priority,
    gpuNode: model.gpu_node,
    enabled: model.enabled,
    gpuName: model.gpu_name,
    gpuVramGb: model.gpu_vram_gb,
    metadataStatus: model.metadata_status,
    inspectionError: model.inspection_error,
  }))
}


export async function fetchSovereigntyStatus(): Promise<SovereigntyStatus> {
  const raw = await request<RawSovereigntyStatus>('/sovereignty-status')
  const services = raw.local_services ?? raw.localServices ?? []
  const integrity = raw.model_integrity ?? raw.modelIntegrity ?? []
  const online = raw.online ?? services.some((s) => s.online)
  return {
    externalCalls: raw.external_calls ?? raw.externalCalls ?? 0,
    localModelCalls: raw.local_model_calls ?? raw.localModelCalls ?? 0,
    localFilesAccessed: raw.local_files_accessed ?? raw.localFilesAccessed ?? 0,
    blockedAttempts: raw.blocked_attempts ?? raw.blockedAttempts ?? 0,
    online,
    verdict: raw.verdict,
    localServices: services.map((s) => ({ port: s.port, name: s.name, address: s.address, online: s.online })),
    modelIntegrity: integrity,
  }
}

export async function fetchTasks(mineOnly = false): Promise<import('./types').TaskItem[]> {
  const endpoint = mineOnly ? '/tasks/mine' : '/tasks'
  const raw = await request<{ tasks: any[] }>(endpoint)
  return (raw.tasks || []).map((t) => ({
    id: t.id,
    userId: t.user_id,
    taskType: t.task_type,
    modelUsed: t.model_used,
    promptPreview: t.prompt_preview || '',
    promptText: t.prompt_text || t.prompt_preview || '',
    inputFilename: t.input_filename,
    finalOutput: t.final_output,
    generatedFile: t.generated_file,
    status: t.status,
    timestamp: t.timestamp || new Date().toISOString(),
    risk: t.risk,
    ownerName: t.owner_name,
    evidenceCount: t.evidence_count,
    artifactSha256: t.artifact_sha256,
    modelRunId: t.model_run_id,
  }))
}

export async function approveTask(taskId: number): Promise<{ approval: import('./types').ApprovalRecord }> {
  const raw = await request<{ status: string; task_id: number; approval: any }>(`/tasks/${taskId}/approve`, { method: 'POST' })
  return {
    approval: {
      approvedBy: raw.approval?.approvedBy ?? '',
      approvedAt: raw.approval?.approvedAt ?? new Date().toISOString(),
      taskId: raw.approval?.taskId ?? `TASK-${taskId}`,
      artifactHash: raw.approval?.artifactHash ?? '',
      modelRunId: raw.approval?.modelRunId ?? '',
      evidenceSetId: raw.approval?.evidenceSetId ?? '',
    },
  }
}

export async function rejectTask(taskId: number): Promise<void> {
  await request(`/tasks/${taskId}/reject`, { method: 'POST' })
}

export async function downloadOutputFile(filename: string): Promise<void> {
  const headers = getAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/outputs/${encodeURIComponent(filename)}`, { headers })
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`)
  }
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Real streaming chat — fetch + ReadableStream (POST carries multipart uploads)
// ---------------------------------------------------------------------------

export async function streamChat(
  message: string,
  file: File | undefined,
  onEvent: (event: import('./types').SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const formData = new FormData()
  formData.append('message', message)
  if (file) formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
    signal,
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again.')
  }
  if (!response.ok || !response.body) {
    let detail = `Chat stream failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* keep status message */
    }
    throw new Error(detail)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = chunk.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        onEvent(JSON.parse(payload) as import('./types').SseEvent)
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Auth + demo role switching (server-verified)
// ---------------------------------------------------------------------------

export interface MeResult {
  username: string
  role: string
  demo: boolean
  demoMode: boolean
}

export async function fetchMe(): Promise<MeResult> {
  return request<MeResult>('/me')
}

export async function switchDemoRole(role: string): Promise<LoginResult & { demo: boolean; demoMode: boolean }> {
  return request<LoginResult & { demo: boolean; demoMode: boolean }>('/demo/switch-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

// ---------------------------------------------------------------------------
// Admin control plane — Tools / Users / Policies / Audit
// ---------------------------------------------------------------------------

export interface ToolInfo {
  name: string
  toolType: string
  status: string
  networkBlocked: boolean
  description?: string
  enabled?: boolean
  seeded?: boolean
  lastToggledBy?: string | null
  lastToggledAt?: string | null
}

export interface UserInfo {
  id: number
  username: string
  role: string
  createdAt?: string
}

export interface AuditEntry {
  id: number
  taskId: string
  owner: string
  modelUsed: string
  status: string
  risk?: string
  evidenceCount?: number
  approvedBy?: string
  approvedAt?: string
  timestamp: string
  generatedFile?: string
}

export async function fetchTools(): Promise<ToolInfo[]> {
  const raw = await request<{ tools?: ToolInfo[] }>('/tools')
  return raw.tools ?? []
}

export interface ModelEntryInput {
  role: string
  endpoint: string
  model_path: string
  model_id?: string
  capabilities?: string[]
  description?: string
  runtime_context_tokens?: number
  load_policy?: string
  priority?: number
  gpu_node?: string
  enabled?: boolean
}

export interface ModelFileInfo {
  path: string
  metadata?: {
    name?: string
    format?: string
    quantization?: string
    architecture?: string
    parameter_count?: string
    model_context_tokens?: number
    file_size_bytes?: number
    tensor_count?: number
    estimated_vram_gb?: number
  }
  error?: string
}

export async function addModel(entry: ModelEntryInput): Promise<void> {
  await request('/admin/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
}

export async function fetchLocalModelFiles(): Promise<ModelFileInfo[]> {
  const raw = await request<{ files?: ModelFileInfo[] }>('/admin/models/files')
  return raw.files ?? []
}

export async function inspectLocalModelFile(modelPath: string): Promise<NonNullable<ModelFileInfo['metadata']>> {
  const raw = await request<{ metadata: NonNullable<ModelFileInfo['metadata']> }>('/admin/models/inspect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_path: modelPath }),
  })
  return raw.metadata
}

export async function removeModel(role: string): Promise<void> {
  await request(`/admin/models/${encodeURIComponent(role)}`, { method: 'DELETE' })
}

export async function updateModelEndpoint(role: string, endpoint: string): Promise<void> {
  await request(`/admin/models/${encodeURIComponent(role)}/endpoint`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
}

export async function reloadModels(): Promise<void> {
  await request('/admin/models/reload', { method: 'POST' })
}

export async function toggleTool(name: string, enabled: boolean): Promise<void> {
  await request(`/admin/tools/${encodeURIComponent(name)}/toggle?enabled=${enabled}`, { method: 'POST' })
}

export async function fetchUsers(): Promise<UserInfo[]> {
  const raw = await request<{ users?: UserInfo[] }>('/users')
  return raw.users ?? []
}

export async function fetchPolicies(): Promise<Record<string, unknown>> {
  const raw = await request<{ policies?: Record<string, unknown> }>('/policies')
  return raw.policies ?? {}
}

export async function fetchAudit(): Promise<AuditEntry[]> {
  const raw = await request<{ events?: AuditEntry[] }>('/audit')
  return raw.events ?? []
}

// ---------------------------------------------------------------------------
// Admin system log + metrics
// ---------------------------------------------------------------------------

export interface SystemLogEntry {
  ts: string
  level: 'INFO' | 'RETR' | 'TOOL' | 'BLOCK' | 'WARN' | 'ERROR' | 'INFER'
  message: string
}

export interface SystemMetrics {
  node: string
  cpu_percent: number
  ram_used_bytes: number
  ram_total_bytes: number
  ram_percent: number
  gpu_available: boolean
  gpu_name: string
  gpu_percent: number
  vram_used_bytes: number
  vram_total_bytes: number
  vram_percent: number
}

export async function fetchSystemLog(limit = 50): Promise<SystemLogEntry[]> {
  const raw = await request<{ entries?: SystemLogEntry[] }>(`/system-log?limit=${limit}`)
  return raw.entries ?? []
}

export async function fetchSystemMetrics(): Promise<SystemMetrics> {
  return request<SystemMetrics>('/system-metrics')
}

export const apiBaseUrl = API_BASE_URL
