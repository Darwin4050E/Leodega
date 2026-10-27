import PhoneFrame from '../../components/PhoneFrame'
import TenantTabBar from '../../components/TenantTabBar'
import ActiveContextEntry from '../../components/ActiveContextEntry'
import { useAuth } from '../../auth/useAuth'
import { useLogout } from '../../auth/useLogout'
import { useActiveContext } from '../../context/useActiveContext'
import { ORGANIZATIONS_STATUS } from '../../context/activeContextBase'

const ROLE_BADGE: Record<string, string> = {
  landlord: 'Gestor de bodega',
  tenant: 'Cliente',
}

/**
 * Tenant and gestor profile (`LgPerfilScreen` in the prototype, trimmed to the entries
 * that have a real destination today). "Cambiar de organización" lives in
 * `ActiveContextEntry`, which already shows the operating context and hides
 * itself for users without organizations; the rest of the prototype's entries
 * (panel, invitations, create organization, settings, help) have no screen yet.
 */
export default function ProfileScreen() {
  const { user } = useAuth()
  const logout = useLogout()
  const { enabled, status, organizations } = useActiveContext()

  // Organizations are a tenant concept; a gestor never sees the context entry.
  const showOrganization =
    user?.role === 'tenant' &&
    enabled &&
    status !== ORGANIZATIONS_STATUS.IDLE &&
    !(status === ORGANIZATIONS_STATUS.READY && organizations.length === 0)

  return (
    <PhoneFrame footer={<TenantTabBar />}>
      <div className="shrink-0 border-b border-lg-line px-5 pb-3 pt-12">
        <h1 className="m-0 text-xl font-bold tracking-tight text-lg-ink">Perfil</h1>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-5">
        <div className="px-1 pb-2">
          <p className="m-0 text-base font-semibold text-lg-ink">
            {user ? `${user.name} ${user.lastname}`.trim() : ''}
          </p>
          <p className="m-0 mt-0.5 text-sm text-lg-t3">{user?.email}</p>
          <span className="mt-2 inline-block rounded-full bg-lg-soft px-2.5 py-1 text-[11px] font-semibold text-lg-primary">
            {user ? (ROLE_BADGE[user.role] ?? user.role) : ''}
          </span>
        </div>

        {showOrganization && (
          <>
            <h2 className="m-0 mt-4 text-[11px] font-bold uppercase tracking-wider text-lg-t4">
              Organización
            </h2>
            <ActiveContextEntry />
          </>
        )}

        <h2 className="m-0 mt-6 mb-2 text-[11px] font-bold uppercase tracking-wider text-lg-t4">
          Cuenta
        </h2>
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-2xl border border-lg-line bg-white px-4 py-3.5 text-left text-sm font-medium text-red-600"
        >
          Cerrar sesión
        </button>
      </div>
    </PhoneFrame>
  )
}
