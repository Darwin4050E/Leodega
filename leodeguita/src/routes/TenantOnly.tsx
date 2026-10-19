import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/** Layout gate for screens that only a tenant can use; anyone else lands on Home. */
export default function TenantOnly() {
  const { user } = useAuth()

  if (user?.role !== 'tenant') return <Navigate to="/" replace />

  return <Outlet />
}
