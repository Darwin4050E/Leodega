import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

type Role = 'admin' | 'landlord' | 'tenant'

/**
 * Layout gate for screens shared by several roles (profile, reservations);
 * anyone else lands on `/`, which sends each role to its own home.
 */
export default function RolesOnly({ roles }: { roles: Role[] }) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
