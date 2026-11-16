import { useEffect, useState, type ReactNode } from 'react';
import { getMyInvitations } from '../services/organizations';
import { CONTEXT_KIND } from '../utils/activeContext';
import { InvitationsInboxContext } from './invitationsInboxBase';
import { useActiveContext } from './useActiveContext';
import { useAuth } from './useAuth';

interface JoinedOrganizations {
  contextKey: string;
  ids: number[];
}

/**
 * Holds the invitee-side pending count shared by the switcher badge, the
 * header drawer and the inbox page. Fetching is gated by the same `enabled`
 * flag as the active context (token and tenant role), so landlord and admin
 * sessions never call GET /invitations.
 */
export function InvitationsInboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { enabled, context } = useActiveContext();
  const ownerId = enabled && user ? user.id : null;
  const contextKey =
    context.kind === CONTEXT_KIND.ORGANIZATION ? `${CONTEXT_KIND.ORGANIZATION}:${context.organizationId}` : CONTEXT_KIND.PERSONAL;

  const [trackedOwnerId, setTrackedOwnerId] = useState(ownerId);
  const [pendingCount, setPendingCount] = useState(0);
  const [reloadCount, setReloadCount] = useState(0);
  const [joined, setJoined] = useState<JoinedOrganizations>({ contextKey, ids: [] });

  if (trackedOwnerId !== ownerId) {
    setTrackedOwnerId(ownerId);
    setPendingCount(0);
    setJoined({ contextKey, ids: [] });
  }

  // The badge only means something for the context the user just joined from:
  // once another one is selected the tag no longer matches and the list is empty.
  const joinedOrganizationIds = joined.contextKey === contextKey ? joined.ids : [];

  useEffect(() => {
    if (ownerId === null) return;
    let cancelled = false;

    getMyInvitations()
      .then((response) => {
        const count = response.data?.pending_count;
        if (!cancelled && typeof count === 'number') setPendingCount(count);
      })
      .catch(() => {
        // A failed count shows no badge and no error UI.
      });

    return () => {
      cancelled = true;
    };
  }, [ownerId, reloadCount]);

  const refreshPendingCount = () => setReloadCount((count) => count + 1);

  const markJoinedOrganization = (organizationId: number) =>
    setJoined((previous) => {
      const ids = previous.contextKey === contextKey ? previous.ids : [];
      return { contextKey, ids: ids.includes(organizationId) ? ids : [...ids, organizationId] };
    });

  return (
    <InvitationsInboxContext.Provider
      value={{
        pendingCount,
        joinedOrganizationIds,
        refreshPendingCount,
        setPendingCount,
        markJoinedOrganization,
      }}
    >
      {children}
    </InvitationsInboxContext.Provider>
  );
}
