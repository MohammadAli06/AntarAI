/**
 * auth.ts — JWT token management for AntarAI frontend.
 *
 * Stores the token in localStorage so it survives page refresh.
 * All API calls should use getAuthHeaders() to attach the Bearer token.
 * On 401 responses the api.ts request() helper calls clearToken() and
 * redirects to the login screen via the registered onUnauthorized callback.
 */

const TOKEN_KEY = 'antar_ai_token'
const USER_KEY  = 'antar_ai_user'

export interface AuthUser {
  username: string
  role: string
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function setUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AuthUser } catch { return null }
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

// ---------------------------------------------------------------------------
// Auth header helper
// ---------------------------------------------------------------------------

export function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

// ---------------------------------------------------------------------------
// Global 401 handler — set once by App.tsx
// ---------------------------------------------------------------------------

let _onUnauthorized: (() => void) | null = null

export function registerUnauthorizedHandler(handler: () => void): void {
  _onUnauthorized = handler
}

export function handleUnauthorized(): void {
  clearToken()
  _onUnauthorized?.()
}
