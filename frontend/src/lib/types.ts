export type Theme = 'dark' | 'light'

export type UserRole = 'engineer' | 'approver' | 'admin'

export type ModelRole = 'general' | 'coder' | 'vision' | string

export type UploadType = 'image' | 'pdf' | 'document'

// ── Extended ViewId including all role-specific routes ────────────────────────
export type ViewId =
  | 'home'
  | 'workspace'
  | 'my-tasks'
  | 'deliverables'
  | 'approvals'
  | 'review-overview'
  | 'approved-outputs'
  | 'audit-history'
  | 'knowledge-base'
  | 'sovereignty-monitor'
  | 'models'
  | 'admin-overview'
  | 'audit-logs'
  | 'tools'
  | 'users'
  | 'policies'

// ── RBAC Permissions ─────────────────────────────────────────────────────────
export type Permission =
  | 'task:create'
  | 'task:view:own'
  | 'task:view:all'
  | 'task:approve'
  | 'knowledge:read'
  | 'knowledge:write'
  | 'knowledge:delete'
  | 'model:read'
  | 'model:manage'
  | 'user:manage'
  | 'audit:read'
  | 'sovereignty:read'
  | 'admin:access'

// ── Task lifecycle ────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'draft'
  | 'planning'
  | 'ready'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'delivered'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'revision'
  | 'failed'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// ── Agent step types for execution trace ─────────────────────────────────────
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type StepType =
  | 'plan'
  | 'route'
  | 'model'
  | 'tool'
  | 'knowledge'
  | 'ocr'
  | 'verification'
  | 'artifact'
  | 'approval'

export interface AgentStep {
  id: string
  stepIndex: number
  type: StepType
  label: string
  status: StepStatus
  startedAt?: string
  completedAt?: string
  durationMs?: number
  // Model routing
  modelRoute?: ModelRoute
  // Tool execution
  toolRun?: ToolRun
  // Knowledge retrieval
  sources?: EvidenceSource[]
  // OCR result
  ocrResult?: OcrResult
  // Verification
  verification?: VerificationResult
  // Artifact generated
  artifact?: Artifact
  detail?: string
  error?: string
}

export interface ModelRoute {
  taskId: string
  detectedCapabilities: string[]
  candidates: { modelName: string; role: ModelRole; score: number }[]
  selected: { modelName: string; role: ModelRole; score: number }
  laterStages?: { stage: string; model: string }[]
}

export interface ToolRun {
  toolName: string
  toolType: 'sandbox' | 'ocr' | 'document-gen' | 'excel' | 'ppt' | 'rag' | 'web-block'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  status: StepStatus
  durationMs?: number
  networkBlocked: boolean
  exitCode?: number
  codeFile?: string
  outputPreview?: string
}

export interface OcrResult {
  pages: number
  textBlocks: number
  tables: number
  confidence: number
  externalCalls: number
}

export interface EvidenceSource {
  id: string
  title: string
  section?: string
  page?: number
  relevanceScore: number
  excerpt?: string
  sourceType: 'sop' | 'manual' | 'previous-task' | 'standard' | 'document'
}

export interface VerificationResult {
  checks: VerificationCheck[]
  confidence: number
  passed: boolean
  summary?: string
}

export interface VerificationCheck {
  label: string
  passed: boolean
  detail?: string
}

export interface Artifact {
  id: string
  filename: string
  fileType: 'docx' | 'xlsx' | 'pdf' | 'pptx' | 'py' | 'json' | string
  sizeBytes: number
  generatedLocally: boolean
  downloadUrl: string
  previewUrl?: string
  sha256?: string
  createdAt: string
}

export interface ApprovalRecord {
  approvedBy: string
  approverTitle?: string
  approvedAt: string
  taskId: string
  artifactHash: string
  modelRunId: string
  evidenceSetId: string
  comment?: string
}

// ── Core Task object ──────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  description: string
  ownerId: string
  ownerName: string
  status: TaskStatus
  risk: RiskLevel
  inputs: UploadedFile[]
  plan: AgentStep[]
  modelRoutes: ModelRoute[]
  sources: EvidenceSource[]
  toolRuns: ToolRun[]
  verification?: VerificationResult
  artifacts: Artifact[]
  requiresApproval: boolean
  approval?: ApprovalRecord
  createdAt: string
  updatedAt: string
  workflowTemplate?: WorkflowTemplate
}

// ── SSE Event types ───────────────────────────────────────────────────────────
export type SseEventType =
  | 'task.created'
  | 'plan.created'
  | 'router.started'
  | 'router.completed'
  | 'model.started'
  | 'model.completed'
  | 'knowledge.started'
  | 'knowledge.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'ocr.started'
  | 'ocr.completed'
  | 'verification.started'
  | 'verification.completed'
  | 'artifact.created'
  | 'approval.required'
  | 'approval.approved'
  | 'approval.rejected'
  | 'task.completed'
  | 'task.failed'

export interface SseEvent {
  type: SseEventType
  taskId: string
  stepId?: string
  timestamp: string
  data?: Record<string, unknown>
}

// ── Workflow templates ────────────────────────────────────────────────────────
export type WorkflowTemplateId =
  | 'inspection-report'
  | 'engineering-calc'
  | 'pid-review'
  | 'document-intelligence'
  | 'code-task'
  | 'executive-brief'

export interface WorkflowTemplate {
  id: WorkflowTemplateId
  title: string
  description: string
  icon: string
  defaultPrompt: string
  capabilities: string[]
  expectedRisk: RiskLevel
  expectedDeliverable: string
}

// ── Legacy / compatibility types ──────────────────────────────────────────────
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
  quantization?: string
  vramGb?: number
  contextLength?: number
  checksum?: string
}

export interface SovereigntyStatus {
  externalCalls: number
  localModelCalls: number
  localFilesAccessed: number
  verdict?: string
  online: boolean
  blockedAttempts?: number
  localServices?: { port: number; name: string; address: string }[]
  modelIntegrity?: { modelFile: string; sha256: string; verified: boolean }[]
}

export interface TaskItem {
  id: number
  userId: number
  taskType: string
  modelUsed: string
  promptPreview: string
  generatedFile?: string
  status: TaskStatus | string
  timestamp: string
  risk?: RiskLevel
  ownerName?: string
  evidenceCount?: number
}

export interface UploadedFile {
  file: File
  type: UploadType
  previewUrl?: string
  ocrStatus?: 'pending' | 'processing' | 'complete'
  visionStatus?: 'pending' | 'processing' | 'complete'
  pageCount?: number
}

export interface NavItem {
  id: ViewId
  label: string
  description: string
  roles?: UserRole[]
  badge?: number
  section?: string
}

export interface ApiErrorState {
  message: string
  scope: 'models' | 'outputs' | 'sovereignty' | 'chat' | 'upload' | 'approvals' | 'tasks'
}
