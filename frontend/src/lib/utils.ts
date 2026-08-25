import type { LucideIcon } from 'lucide-react'
import { FileCode2, FileSpreadsheet, FileText, Presentation, ScanText } from 'lucide-react'
import type { ModelRole, UploadType } from './types'

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return 'Local output'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(typeOrName: string): LucideIcon {
  const value = typeOrName.toLowerCase()
  if (value.includes('spreadsheet') || value.includes('excel') || value.endsWith('xlsx') || value.endsWith('csv')) return FileSpreadsheet
  if (value.includes('presentation') || value.includes('powerpoint') || value.endsWith('pptx')) return Presentation
  if (value.includes('code') || value.endsWith('py') || value.endsWith('js') || value.endsWith('ts')) return FileCode2
  if (value.includes('scan') || value.includes('image') || value.endsWith('pdf')) return ScanText
  return FileText
}

export function getUploadType(file: File): UploadType | null {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('image/')) return 'image'
  return null
}

export function getRoleLabel(role: ModelRole): string {
  if (role === 'coder') return 'Coding task'
  if (role === 'vision') return 'Document / vision task'
  return 'General reasoning'
}

export function getStatusLabel(status: string): string {
  const normalized = status.toLowerCase()
  if (normalized === 'mock') return 'Local mock'
  if (normalized === 'online' || normalized === 'active') return 'Active'
  return status
}

export function formatLogTime(index: number): string {
  const seconds = 4 + index * 3
  return `00:31:${String(seconds).padStart(2, '0')}`
}
