export const CONTEXT_KIND = {
  PERSONAL: 'personal',
  ORGANIZATION: 'organization',
} as const;

export const ORGANIZATION_HEADER = 'X-Organization-Id';
export const ORGANIZATION_FORBIDDEN_MESSAGE = 'No perteneces a la organización seleccionada';

const ORGANIZATION_ID_PATTERN = /^[1-9][0-9]*$/;

interface SessionUser {
  id: number;
  role: string | null;
}

type ForcedPersonalListener = () => void;

const forcedPersonalListeners = new Set<ForcedPersonalListener>();

export function activeContextKey(userId: number): string {
  return `active_context:${userId}`;
}

export function parseOrganizationId(raw: string | null): number | null {
  if (raw === null || !ORGANIZATION_ID_PATTERN.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function readSessionUser(): SessionUser | null {
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { id, role } = parsed as { id?: unknown; role?: unknown };
    if (typeof id !== 'number') return null;
    return { id, role: typeof role === 'string' ? role : null };
  } catch {
    return null;
  }
}

export function readStoredOrganizationId(userId: number): number | null {
  return parseOrganizationId(localStorage.getItem(activeContextKey(userId)));
}

export function writeStoredOrganizationId(userId: number, organizationId: number): void {
  localStorage.setItem(activeContextKey(userId), String(organizationId));
}

export function clearStoredActiveContext(): void {
  const user = readSessionUser();
  if (user) localStorage.removeItem(activeContextKey(user.id));
}

export function readRequestOrganizationId(): number | null {
  if (!localStorage.getItem('auth_token')) return null;
  const user = readSessionUser();
  if (!user || user.role !== 'tenant') return null;
  return readStoredOrganizationId(user.id);
}

export function forcePersonalContext(): void {
  clearStoredActiveContext();
  forcedPersonalListeners.forEach((listener) => listener());
}

export function subscribeToForcedPersonal(listener: ForcedPersonalListener): () => void {
  forcedPersonalListeners.add(listener);
  return () => {
    forcedPersonalListeners.delete(listener);
  };
}
