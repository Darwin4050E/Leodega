import { createContext } from 'react';
import type { Organization } from '../services/organizations';
import { CONTEXT_KIND } from '../utils/activeContext';

export const ORGANIZATIONS_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type OrganizationsStatus = (typeof ORGANIZATIONS_STATUS)[keyof typeof ORGANIZATIONS_STATUS];

export type ActiveContextSelection =
  | { kind: typeof CONTEXT_KIND.PERSONAL }
  | { kind: typeof CONTEXT_KIND.ORGANIZATION; organizationId: number };

export interface ActiveContextValue {
  context: ActiveContextSelection;
  activeOrganization: Organization | null;
  organizations: Organization[];
  status: OrganizationsStatus;
  enabled: boolean;
  selectOrganization: (organizationId: number) => void;
  selectPersonal: () => void;
  activateOrganization: (organization: Organization) => void;
  reloadOrganizations: () => void;
}

export const ActiveContext = createContext<ActiveContextValue | undefined>(undefined);
