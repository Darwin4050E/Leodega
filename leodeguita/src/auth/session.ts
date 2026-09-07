/**
 * Single place that reads and writes the persisted session (token + user).
 *
 * Storage note: Leodeguita is a PWA, so it runs in the browser sandbox and has
 * no native secure keystore. We use localStorage — same tradeoff the web client
 * already accepts (frontend/src/context/AuthContext.tsx). The compensating
 * control for risk R-02 shifts from "native secure storage" to short-lived
 * tokens plus centralized revocation on the backend.
 */
import type { AuthUser } from './authContextBase'

const TOKEN_KEY = 'leodeguita_token'
const USER_KEY = 'leodeguita_user'

export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function readUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function writeSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
