import { readToken, readUser } from '../auth/session'

/**
 * Single place that reads and writes the tenant's chosen organization.
 *
 * The id lives in localStorage under a per-user key so the HTTP client (which
 * cannot use hooks) reads it at request time, the same way it reaches the
 * session through auth/session.ts. Absent or unparsable means personal context.
 */
export const ORGANIZATION_HEADER = 'X-Organization-Id'
export const ORGANIZATION_FORBIDDEN_MESSAGE = 'No perteneces a la organización seleccionada'

const KEY_PREFIX = 'leodeguita_active_context:'
const ORGANIZATION_ID_PATTERN = /^[1-9][0-9]*$/

type ForcedPersonalHandler = () => void

let forcedPersonalHandler: ForcedPersonalHandler | null = null

export function activeContextKey(userId: number): string {
  return `${KEY_PREFIX}${userId}`
}

export function parseOrganizationId(raw: string | null): number | null {
  if (raw === null || !ORGANIZATION_ID_PATTERN.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}

/** The stored session user is unvalidated JSON, so id and role are checked here. */
function readSessionUser(): { id: number; role: string | null } | null {
  const user: unknown = readUser()
  if (typeof user !== 'object' || user === null) return null
  const { id, role } = user as { id?: unknown; role?: unknown }
  if (typeof id !== 'number') return null
  return { id, role: typeof role === 'string' ? role : null }
}

export function readStoredOrganizationId(userId: number): number | null {
  return parseOrganizationId(localStorage.getItem(activeContextKey(userId)))
}

export function writeStoredOrganizationId(userId: number, organizationId: number): void {
  localStorage.setItem(activeContextKey(userId), String(organizationId))
}

export function clearStoredOrganizationId(userId: number): void {
  localStorage.removeItem(activeContextKey(userId))
}

/** Must run before the session is cleared: the user is read to find the key. */
export function clearStoredActiveContext(): void {
  const user = readSessionUser()
  if (user) clearStoredOrganizationId(user.id)
}

export function readRequestOrganizationId(): number | null {
  if (!readToken()) return null
  const user = readSessionUser()
  if (!user || user.role !== 'tenant') return null
  return readStoredOrganizationId(user.id)
}

export function forcePersonalContext(): void {
  clearStoredActiveContext()
  forcedPersonalHandler?.()
}

/** Lets the React provider follow a forced reset without the HTTP client importing it. */
export function registerForcedPersonalHandler(fn: ForcedPersonalHandler): () => void {
  forcedPersonalHandler = fn
  return () => {
    if (forcedPersonalHandler === fn) forcedPersonalHandler = null
  }
}
