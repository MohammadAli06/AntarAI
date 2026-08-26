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
}

interface RawSovereigntyStatus {
  external_calls?: number
  externalCalls?: number
  local_model_calls?: number
  localModelCalls?: number
  local_files_accessed?: number
  localFilesAccessed?: number
  verdict?: string
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

export async function fetchModels(): Promise<ModelInfo[]> {
  const raw = await request<{ models?: RawModel[] }>('/models')
  return (raw.models || []).map((model) => ({
    name: model.name || 'Unnamed model',
    role: model.role || 'general',
    status: model.status || 'unknown',
    description: model.description,
    endpoint: model.endpoint,
  }))
}

export async function fetchSovereigntyStatus(): Promise<SovereigntyStatus> {
  const raw = await request<RawSovereigntyStatus>('/sovereignty-status')
  return {
    externalCalls: raw.external_calls ?? raw.externalCalls ?? 0,
    localModelCalls: raw.local_model_calls ?? raw.localModelCalls ?? 0,
    localFilesAccessed: raw.local_files_accessed ?? raw.localFilesAccessed ?? 0,
    verdict: raw.verdict,
    online: true,
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
    generatedFile: t.generated_file,
    status: t.status,
    timestamp: t.timestamp || new Date().toISOString(),
  }))
}

export async function approveTask(taskId: number): Promise<void> {
  await request(`/tasks/${taskId}/approve`, { method: 'POST' })
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

export const apiBaseUrl = API_BASE_URL

