import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './authContextBase'
import { clearSession, readToken, readUser, writeSession } from './session'
import { registerUnauthorizedHandler } from './sessionExpiry'

/**
 * Single source of the session for the whole app. Components read `token` /
 * `user` and call `setSession` / `clear` instead of touching localStorage
 * directly. The axios interceptors (src/api/client.ts) are the deliberate
 * exception, because they are not React components and cannot use hooks: they
 * reach storage through session.ts and report a 401 via sessionExpiry.ts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken())
  const [user, setUser] = useState<AuthUser | null>(() => readUser())
  const [sessionExpired, setSessionExpired] = useState(false)

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    writeSession(newToken, newUser)
    setToken(newToken)
    setUser(newUser)
    setSessionExpired(false)
  }, [])

  const clear = useCallback(() => {
    clearSession()
    setToken(null)
    setUser(null)
    setSessionExpired(false)
  }, [])

  useEffect(
    () =>
      registerUnauthorizedHandler(() => {
        setToken(null)
        setUser(null)
        setSessionExpired(true)
      }),
    [],
  )

  const value = useMemo(
    () => ({ token, user, sessionExpired, setSession, clear }),
    [token, user, sessionExpired, setSession, clear],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
