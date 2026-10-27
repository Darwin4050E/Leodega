import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * Bottom navigation for the tenant, mirrors the prototype's `LBottomNav` /
 * `navCliente`. Only the tabs that have a screen today are listed (the
 * prototype's Inventario and Mensajes are out of scope). Renders nothing for
 * other roles so shared screens such as the catalog can mount it safely.
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

const TABS = [
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
  {
    to: '/reservas',
    label: 'Reservas',
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </Icon>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </Icon>
    ),
  },
]

export default function TenantTabBar() {
  const { user } = useAuth()
  if (user?.role !== 'tenant') return null

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-10 shrink-0 border-t border-lg-line bg-white/95 px-2 pb-6 pt-2 backdrop-blur"
    >
      <div className="flex">
        {TABS.map((tab) => (
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
