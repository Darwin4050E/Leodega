import { useAuth } from '../auth/useAuth'
import { useLogout } from '../auth/useLogout'
import PhoneFrame from '../components/PhoneFrame'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  landlord: 'Gestor de Almacenamiento',
  tenant: 'Cliente',
}

/**
 * Placeholder landing after login for the admin (HUL-01 AC-1). Tenant and
 * landlord land on their own screens via `RoleHome`.
 */
export default function HomeScreen() {
  const { user } = useAuth()
  const handleLogout = useLogout()

  return (
    <PhoneFrame>
      <div className="flex-1 flex flex-col px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Rol: {user ? (ROLE_LABEL[user.role] ?? user.role) : ''}
        </p>

        <p className="mt-8 text-sm text-gray-400">
          Pantalla principal en construcción.
        </p>

        <button
          onClick={handleLogout}
          className="mt-auto w-full rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700"
        >
          Cerrar sesión
        </button>
      </div>
    </PhoneFrame>
  )
}
