import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import HomeScreen from '../screens/HomeScreen'

/**
 * The `/` landing. A tenant has no dashboard of its own: Explorar (the
 * catalog) is its home, and a landlord's is Mis bodegas. Only the admin keeps
 * the placeholder Home.
 */
export default function RoleHome() {
  const { user } = useAuth()

  if (user?.role === 'tenant') return <Navigate to="/bodegas" replace />
  if (user?.role === 'landlord') return <Navigate to="/mis-bodegas" replace />

  return <HomeScreen />
}
