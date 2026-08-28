import type { ReactNode } from 'react'
import type { Permission, UserRole } from './types'
import { getUser } from './auth'

// ── Role → Permission map ─────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  engineer: [
    'task:create',
    'task:view:own',
    'knowledge:read',
    'model:read',
    'sovereignty:read',
    'audit:read',
  ],
  approver: [
    'task:view:all',
    'task:approve',
    'knowledge:read',
    'model:read',
    'sovereignty:read',
    'audit:read',
  ],
  admin: [
    'task:create',
    'task:view:own',
    'task:view:all',
    'task:approve',
    'knowledge:read',
    'knowledge:write',
    'knowledge:delete',
    'model:read',
    'model:manage',
    'user:manage',
    'audit:read',
    'sovereignty:read',
    'admin:access',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function getCurrentUserPermissions(): Permission[] {
  const user = getUser()
  const role = (user?.role as UserRole) || 'engineer'
  return ROLE_PERMISSIONS[role] ?? []
}

export function currentUserHasPermission(permission: Permission): boolean {
  const user = getUser()
  const role = (user?.role as UserRole) || 'engineer'
  return hasPermission(role, permission)
}

// ── PermissionGate component ──────────────────────────────────────────────────
interface PermissionGateProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  return currentUserHasPermission(permission) ? <>{children}</> : <>{fallback}</>
}
