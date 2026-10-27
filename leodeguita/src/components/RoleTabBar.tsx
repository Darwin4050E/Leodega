import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * Bottom navigation by role, mirrors the prototype's `LBottomNav` with
 * `navCliente` / `navGestor`. Only the tabs that have a screen today are
 * listed (the prototype's Inventario and Mensajes are out of scope). Renders
 * nothing for other roles so shared screens can mount it safely.
 */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[23px] w-[23px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

interface Tab {
  to: string
  label: string
  icon: ReactNode
}

const RESERVAS_TAB: Tab = {
  to: '/reservas',
  label: 'Reservas',
  icon: (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Icon>
  ),
}

const PERFIL_TAB: Tab = {
  to: '/perfil',
  label: 'Perfil',
  icon: (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </Icon>
  ),
}

const TENANT_TABS: Tab[] = [
  {
    to: '/bodegas',
    label: 'Explorar',
    icon: (
      <Icon>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </Icon>
    ),
  },
  RESERVAS_TAB,
  PERFIL_TAB,
]

const LANDLORD_TABS: Tab[] = [
  {
    to: '/mis-bodegas',
    label: 'Mis bodegas',
    icon: (
      <Icon>
        <path d="M3 10l9-6 9 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21v-7h6v7" />
      </Icon>
    ),
  },
  RESERVAS_TAB,
  PERFIL_TAB,
]

const TABS_BY_ROLE: Record<string, Tab[]> = {
  tenant: TENANT_TABS,
  landlord: LANDLORD_TABS,
}

export default function RoleTabBar() {
  const { user } = useAuth()
  const tabs = user ? TABS_BY_ROLE[user.role] : undefined
  if (!tabs) return null

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-10 shrink-0 border-t border-lg-line bg-white/95 px-2 pb-6 pt-2 backdrop-blur"
    >
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-1 no-underline ${
                isActive ? 'font-semibold text-lg-primary' : 'font-medium text-lg-t4'
              }`
            }
          >
            {tab.icon}
            <span className="text-[10.5px]">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
