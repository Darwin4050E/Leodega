import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SESSION_EXPIRED_REASON } from '../auth/sessionExpiry'

/**
 * Gate for screens that require an authenticated session. It is the only
 * owner of the redirect to /login, so an expired session carries its return
 * route and reason in the same navigation.
 */
export default function Protected() {
  const { token, user, sessionExpired } = useAuth()
  const location = useLocation()

  if (!token || !user) {
    if (sessionExpired) {
      const from = location.pathname + location.search + location.hash
      return (
        <Navigate
          to="/login"
          replace
          state={{ from, reason: SESSION_EXPIRED_REASON }}
        />
      )
    }
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
