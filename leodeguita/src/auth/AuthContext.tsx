import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthUser } from './authContextBase'
import { clearSession, readToken, readUser, writeSession } from './session'

/**
 * Single source of the session for the whole app. Components read `token` /
 * `user` and call `setSession` / `clear` instead of touching localStorage
 * directly. The axios interceptor (src/api/client.ts) is the one deliberate
 * exception, because it is not a React component and cannot use hooks.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken())
  const [user, setUser] = useState<AuthUser | null>(() => readUser())

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    writeSession(newToken, newUser)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const clear = useCallback(() => {
    clearSession()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ token, user, setSession, clear }),
    [token, user, setSession, clear],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
