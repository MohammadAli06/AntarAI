export type ViewId = 'workspace' | 'approvals' | 'knowledge-base' | 'sovereignty-monitor' | 'models'

export type UserRole = 'engineer' | 'approver' | 'admin'

export type ModelRole = 'general' | 'coder' | 'vision' | string

export type UploadType = 'image' | 'pdf' | 'document'

export interface ChatResponse {
  response: string
  modelUsed: string
  role: ModelRole
  steps: string[]
  generatedFile?: string
}

export interface OutputFile {
  name: string
  type: string
  sizeBytes?: number
  url: string
}

export interface ModelInfo {
  name: string
  role: ModelRole
  status: string
  description?: string
  endpoint?: string
}

export interface SovereigntyStatus {
  externalCalls: number
  localModelCalls: number
  localFilesAccessed: number
  verdict?: string
  online: boolean
}

export interface TaskItem {
  id: number
  userId: number
  taskType: string
  modelUsed: string
  promptPreview: string
  generatedFile?: string
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | string
  timestamp: string
}

export interface UploadedFile {
  file: File
  type: UploadType
  previewUrl?: string
}

export interface NavItem {
  id: ViewId
  label: string
  description: string
  roles?: UserRole[]
}

export interface ApiErrorState {
  message: string
  scope: 'models' | 'outputs' | 'sovereignty' | 'chat' | 'upload' | 'approvals'
}

