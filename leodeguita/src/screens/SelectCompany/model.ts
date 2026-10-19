import { ACTIVE_CONTEXT_COPY } from '../../context/activeContextCopy'
import type { OrganizationRole } from '../../services/organizations'

/** Router state key set by the login screen to mark the one-shot post-login gate. */
export const POST_LOGIN_GATE = 'postLoginGate'

const FALLBACK_INITIALS = 'OR'
const MAX_INITIALS = 2

export function organizationInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
  return letters || FALLBACK_INITIALS
}

export function roleLabel(role: OrganizationRole): string {
  return role === 'admin' ? ACTIVE_CONTEXT_COPY.roleAdmin : ACTIVE_CONTEXT_COPY.roleMember
}
