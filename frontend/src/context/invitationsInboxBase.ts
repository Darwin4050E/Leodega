import { createContext } from 'react';

export interface InvitationsInboxValue {
  /** Effective pending invitations of the signed-in tenant, from `pending_count`. */
  pendingCount: number;
  /** Organizations joined in the current context, shown as "Recién te uniste". */
  joinedOrganizationIds: number[];
  refreshPendingCount: () => void;
  setPendingCount: (count: number) => void;
  markJoinedOrganization: (organizationId: number) => void;
}

const NO_JOINED_ORGANIZATIONS: number[] = [];

/**
 * Value used when no provider is mounted (landlord and admin shells, isolated
 * component tests): no badge, no request, every action is a no-op.
 */
export const INERT_INVITATIONS_INBOX: InvitationsInboxValue = {
  pendingCount: 0,
  joinedOrganizationIds: NO_JOINED_ORGANIZATIONS,
  refreshPendingCount: () => {},
  setPendingCount: () => {},
  markJoinedOrganization: () => {},
};

export const InvitationsInboxContext = createContext<InvitationsInboxValue>(INERT_INVITATIONS_INBOX);
