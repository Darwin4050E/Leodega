import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/** Gate for screens that require an authenticated session. */
export default function Protected() {
  const { token, user } = useAuth()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
