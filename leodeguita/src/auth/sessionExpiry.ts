import { clearSession, readToken } from './session'

export const SESSION_EXPIRED_REASON = 'session-expired'
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión terminó, inicia sesión de nuevo'

type UnauthorizedHandler = () => void

let handler: UnauthorizedHandler | null = null

/** Lets the React provider react to a 401 without the HTTP client importing it. */
export function registerUnauthorizedHandler(fn: UnauthorizedHandler): () => void {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}

/**
 * Called by the HTTP client on a 401. Clearing storage synchronously makes
 * concurrent 401s fire once: later calls find no token and return early.
 */
export function handleUnauthorized(sentAuthorization: unknown): void {
  const token = readToken()
  // A 401 for a token that is no longer current (re-login in between) is stale.
  if (!token || sentAuthorization !== `Bearer ${token}`) return
  clearSession()
  handler?.()
}
