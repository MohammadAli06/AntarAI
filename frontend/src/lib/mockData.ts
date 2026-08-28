import type {
  Task,
  AgentStep,
  EvidenceSource,
  VerificationResult,
  Artifact,
  WorkflowTemplate,
  TaskItem,
} from './types'

// ── Workflow Templates ────────────────────────────────────────────────────────
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'inspection-report',
    title: 'Inspection Report → Approval Note',
    description: 'Extract findings → SOP check → Approval note',
    icon: '📋',
    defaultPrompt:
      'Analyze the attached inspection report, cross-reference findings against applicable SOPs, and generate a formal approval note with executive summary, findings, and recommendations.',
    capabilities: ['multimodal', 'rag', 'document-generation'],
    expectedRisk: 'high',
    expectedDeliverable: 'Approval_Note.docx',
  },
  {
    id: 'engineering-calc',
    title: 'Engineering Calculation',
    description: 'Extract parameters → Calculate → Verify → Excel',
    icon: '⚙️',
    defaultPrompt:
      'Extract the engineering parameters from the attached document and perform the required calculations. Verify results against design standards and output a structured Excel report.',
    capabilities: ['reasoning', 'code-execution', 'document-generation'],
    expectedRisk: 'medium',
    expectedDeliverable: 'Calculation_Report.xlsx',
  },
  {
    id: 'pid-review',
    title: 'P&ID Review',
    description: 'Vision analysis → Tag extraction → Findings',
    icon: '🔧',
    defaultPrompt:
      'Perform a detailed review of the P&ID drawing. Extract equipment tags, identify potential issues or deviations, and generate a structured findings report.',
    capabilities: ['vision', 'reasoning'],
    expectedRisk: 'high',
    expectedDeliverable: 'PID_Review_Report.docx',
  },
  {
    id: 'document-intelligence',
    title: 'Document Intelligence',
    description: 'OCR → Summarize → Knowledge comparison',
    icon: '📄',
    defaultPrompt:
      'Process the attached document using OCR, generate a comprehensive summary, and compare key findings against the organizational knowledge base.',
    capabilities: ['ocr', 'rag', 'reasoning'],
    expectedRisk: 'low',
    expectedDeliverable: 'Document_Summary.docx',
  },
  {
    id: 'code-task',
    title: 'Code Task',
    description: 'Generate → Sandbox → Test → Deliver',
    icon: '💻',
    defaultPrompt:
      'Write a Python script based on the requirements. Execute it in the local sandbox, verify outputs, and deliver the tested code with documentation.',
    capabilities: ['code-execution', 'reasoning'],
    expectedRisk: 'medium',
    expectedDeliverable: 'solution.py',
  },
  {
    id: 'executive-brief',
    title: 'Executive Brief',
    description: 'Analyze docs → Generate PPT',
    icon: '📊',
    defaultPrompt:
      'Analyze the provided operational data and generate an executive briefing presentation with key metrics, insights, and recommendations.',
    capabilities: ['reasoning', 'document-generation', 'rag'],
    expectedRisk: 'low',
    expectedDeliverable: 'Executive_Brief.pptx',
  },
]

// ── Mock Evidence Sources ─────────────────────────────────────────────────────
export const MOCK_SOURCES: EvidenceSource[] = [
  {
    id: 'src-1',
    title: 'MRPL-PUMP-SOP-042',
    section: 'Section 6.2 — Vibration Limits',
    page: 17,
    relevanceScore: 0.94,
    excerpt:
      'Maximum allowable vibration for centrifugal pumps at rated speed shall not exceed 4.5 mm/s RMS. Values exceeding this threshold require immediate inspection.',
    sourceType: 'sop',
  },
  {
    id: 'src-2',
    title: 'Pump Maintenance Manual Rev. 7',
    section: 'Chapter 4 — Bearing Inspection',
    page: 42,
    relevanceScore: 0.89,
    excerpt:
      'Bearing temperature must be recorded at startup and after 30 minutes of continuous operation. Deviation >15°C from baseline requires investigation.',
    sourceType: 'manual',
  },
  {
    id: 'src-3',
    title: 'Inspection Standard IS-PMP-2024',
    section: '3.1 — Acceptance Criteria',
    page: 8,
    relevanceScore: 0.81,
    excerpt:
      'Acceptance of pump reinstatement requires documented verification of all checklist items in Appendix A, signed by the certifying engineer.',
    sourceType: 'standard',
  },
  {
    id: 'src-4',
    title: 'Previous Approval Note #221',
    section: 'Findings Summary',
    page: 2,
    relevanceScore: 0.73,
    excerpt:
      'Pump P-199 approved for reinstatement following similar vibration exceedance event on 2026-03-14. Corrective action: bearing replacement.',
    sourceType: 'previous-task',
  },
]

// ── Mock Verification Result ──────────────────────────────────────────────────
export const MOCK_VERIFICATION: VerificationResult = {
  passed: true,
  confidence: 0.92,
  summary: 'All 5 verification checks passed. Document is ready for approval.',
  checks: [
    { label: 'Evidence coverage', passed: true, detail: '4 of 4 findings grounded in source documents' },
    { label: 'Calculations reproduced', passed: true, detail: 'Vibration calculation verified against SOP limits' },
    { label: 'Required fields present', passed: true, detail: 'All mandatory fields in approval note template populated' },
    { label: 'SOP threshold matched', passed: true, detail: 'MRPL-PUMP-SOP-042 §6.2 compliance verified' },
    { label: 'No external source used', passed: true, detail: '0 external API calls made during execution' },
  ],
}

// ── Mock Artifacts ────────────────────────────────────────────────────────────
export const MOCK_ARTIFACTS: Artifact[] = [
  {
    id: 'art-1',
    filename: 'Approval_Note_TASK-1042.docx',
    fileType: 'docx',
    sizeBytes: 24576,
    generatedLocally: true,
    downloadUrl: '/outputs/Approval_Note_TASK-1042.docx',
    sha256: '7134FA9182bc4e1a9f2c8d3e6b5f0a1c84CD',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'art-2',
    filename: 'Inspection_Summary_P201.xlsx',
    fileType: 'xlsx',
    sizeBytes: 41984,
    generatedLocally: true,
    downloadUrl: '/outputs/Inspection_Summary_P201.xlsx',
    createdAt: new Date().toISOString(),
  },
]

// ── Mock Agent Steps for Inspection Report workflow ───────────────────────────
export function makeMockSteps(): AgentStep[] {
  return [
    {
      id: 'step-1',
      stepIndex: 1,
      type: 'plan',
      label: 'Analyze request',
      status: 'completed',
      durationMs: 420,
    },
    {
      id: 'step-2',
      stepIndex: 2,
      type: 'route',
      label: 'Route task to model',
      status: 'completed',
      durationMs: 180,
      modelRoute: {
        taskId: 'TASK-1042',
        detectedCapabilities: ['Document understanding', 'Visual understanding', 'Reasoning'],
        candidates: [
          { modelName: 'Qwen-VL', role: 'vision', score: 0.94 },
          { modelName: 'Qwen3-8B', role: 'general', score: 0.76 },
          { modelName: 'Qwen-Coder', role: 'coder', score: 0.21 },
        ],
        selected: { modelName: 'Qwen-VL', role: 'vision', score: 0.94 },
        laterStages: [
          { stage: 'Reasoning', model: 'Qwen3-8B (General)' },
          { stage: 'Document', model: 'Document Generator' },
        ],
      },
    },
    {
      id: 'step-3',
      stepIndex: 3,
      type: 'ocr',
      label: 'Extract document text',
      status: 'completed',
      durationMs: 2100,
      ocrResult: {
        pages: 14,
        textBlocks: 156,
        tables: 3,
        confidence: 0.96,
        externalCalls: 0,
      },
    },
    {
      id: 'step-4',
      stepIndex: 4,
      type: 'knowledge',
      label: 'Retrieve relevant SOPs',
      status: 'completed',
      durationMs: 840,
      sources: MOCK_SOURCES,
    },
    {
      id: 'step-5',
      stepIndex: 5,
      type: 'model',
      label: 'Evaluate inspection findings',
      status: 'completed',
      durationMs: 3200,
      detail: 'General Reasoning Model — Qwen3-8B-Q4_K_M',
    },
    {
      id: 'step-6',
      stepIndex: 6,
      type: 'tool',
      label: 'Generate approval note',
      status: 'completed',
      durationMs: 1650,
      toolRun: {
        toolName: 'Document Generator',
        toolType: 'document-gen',
        status: 'completed',
        networkBlocked: true,
        durationMs: 1650,
        outputPreview: 'Approval_Note_TASK-1042.docx',
      },
    },
    {
      id: 'step-7',
      stepIndex: 7,
      type: 'verification',
      label: 'Verify output',
      status: 'completed',
      durationMs: 620,
      verification: MOCK_VERIFICATION,
    },
    {
      id: 'step-8',
      stepIndex: 8,
      type: 'artifact',
      label: 'Deliver artifacts',
      status: 'completed',
      durationMs: 90,
      artifact: MOCK_ARTIFACTS[0],
    },
  ]
}

// ── Full Mock Task ────────────────────────────────────────────────────────────
export const MOCK_TASK: Task = {
  id: 'TASK-1042',
  title: 'Pump P-201 Inspection Report → Approval Note',
  description:
    'Analyze the attached inspection report for Pump P-201, cross-reference findings against MRPL-PUMP-SOP-042, and generate a formal approval note.',
  ownerId: 'engineer1',
  ownerName: 'Engineer Ali',
  status: 'pending_approval',
  risk: 'high',
  inputs: [],
  plan: makeMockSteps(),
  modelRoutes: [],
  sources: MOCK_SOURCES,
  toolRuns: [],
  verification: MOCK_VERIFICATION,
  artifacts: MOCK_ARTIFACTS,
  requiresApproval: true,
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  workflowTemplate: WORKFLOW_TEMPLATES[0],
}

// ── Mock Approval Queue ───────────────────────────────────────────────────────
export const MOCK_APPROVAL_QUEUE: TaskItem[] = [
  {
    id: 1042,
    userId: 1,
    taskType: 'inspection-report',
    modelUsed: 'Qwen-VL + Qwen3-8B',
    promptPreview: 'Pump P-201 Inspection Report → Approval Note',
    generatedFile: 'Approval_Note_TASK-1042.docx',
    status: 'pending_approval',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    risk: 'high',
    ownerName: 'engineer1',
    evidenceCount: 6,
  },
  {
    id: 1041,
    userId: 2,
    taskType: 'engineering-calc',
    modelUsed: 'Qwen-Coder',
    promptPreview: 'CDU Pressure Drop Calculation — Unit 4',
    generatedFile: 'Pressure_Calc_CDU4.xlsx',
    status: 'pending_approval',
    timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    risk: 'medium',
    ownerName: 'engineer2',
    evidenceCount: 3,
  },
]

// ── SSE event stream factory ──────────────────────────────────────────────────
export function* mockSseStream(taskId: string) {
  const steps = makeMockSteps()
  for (const step of steps) {
    yield {
      type: step.type === 'route' ? 'router.completed' : `${step.type}.completed`,
      taskId,
      stepId: step.id,
      timestamp: new Date().toISOString(),
      data: { step },
    }
  }
  yield {
    type: 'task.completed',
    taskId,
    timestamp: new Date().toISOString(),
    data: { artifacts: MOCK_ARTIFACTS, verification: MOCK_VERIFICATION },
  }
}
