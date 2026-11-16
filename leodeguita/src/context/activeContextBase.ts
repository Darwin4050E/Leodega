import { createContext } from 'react'
import type { Organization } from '../services/organizations'

export const ORGANIZATIONS_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
} as const

export type OrganizationsStatus = (typeof ORGANIZATIONS_STATUS)[keyof typeof ORGANIZATIONS_STATUS]

export interface ActiveContextValue {
  /** True for an authenticated tenant; everyone else stays personal and idle. */
  enabled: boolean
  status: OrganizationsStatus
  /** Last good list while reloading, empty on error and while idle. */
  organizations: Organization[]
  /** The stored organization id, or null for the personal context. */
  storedOrganizationId: number | null
  /** The list item matching the stored id; null until the list resolves it. */
  activeOrganization: Organization | null
  selectOrganization: (organizationId: number) => void
  selectPersonal: () => void
  reloadOrganizations: () => void
}

export const ActiveContext = createContext<ActiveContextValue | undefined>(undefined)
