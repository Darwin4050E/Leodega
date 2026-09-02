import { createContext } from 'react'

/**
 * Mirrors the shape returned by the shared backend `POST /api/login`
 * (AuthController::login) so Leodeguita and the web client speak about the
 * session in the same terms.
 */
export interface AuthUser {
  id: number
  name: string
  lastname: string
  email: string
  phone?: string
  role: 'admin' | 'landlord' | 'tenant'
  landlord?: { id: number; [key: string]: unknown } | null
  tenant?: { id: number; [key: string]: unknown } | null
  [key: string]: unknown
}

export interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  setSession: (token: string, user: AuthUser) => void
  clear: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
