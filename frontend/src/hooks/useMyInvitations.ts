import { useEffect, useRef, useState } from "react";
import {
  acceptInvitation,
  getMyInvitations,
  rejectInvitation,
  type InboxInvitation,
  type Organization,
} from "../services/organizations";
import { useActiveContext } from "../context/useActiveContext";
import { useInvitationsInbox } from "../context/useInvitationsInbox";
import { RESPOND_ACTION, resolveRespondFailure, type RespondAction } from "../utils/invitationCopy";

export const INBOX_STATUS = {
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export type InboxStatus = (typeof INBOX_STATUS)[keyof typeof INBOX_STATUS];

// What the last request settled to. A failed reload keeps the items it already
// had, so a stale row never disappears just because the network blinked.
interface InboxView {
  status: typeof INBOX_STATUS.READY | typeof INBOX_STATUS.ERROR;
  items: InboxInvitation[];
  /** The last card left because of a reject in this visit; any fetch that settles clears it. */
  rejectedEmpty: boolean;
}

/** An accepted invitation waiting for the user to pick a context (INV-W11). */
export interface AcceptedConfirmation {
  invitationId: number;
  organization: Organization;
}

const NO_ITEMS: InboxInvitation[] = [];

/**
 * The invitee inbox (huc-14 INV-W9..INV-W12). The list is the server's:
 * pending items first, then the most recent expired ones, and it is never
 * re-sorted here. Every load publishes `pending_count` to the shared badge
 * count; a response that lands after unmount is dropped by the effect cleanup
 * (WS80). Accepting never switches the active context: it only reloads the
 * organization list and keeps a confirmation for the page to render.
 */
export function useMyInvitations() {
  const { reloadOrganizations } = useActiveContext();
  const { setPendingCount, refreshPendingCount, markJoinedOrganization } = useInvitationsInbox();
  const [view, setView] = useState<InboxView | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [busy, setBusy] = useState<Record<number, RespondAction>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<AcceptedConfirmation[]>([]);
  // Written synchronously so a double click can never slip a second request in
  // before the re-render that disables the buttons.
  const inFlightIds = useRef(new Set<number>());

  useEffect(() => {
    let ignore = false;

    getMyInvitations()
      .then((response) => {
        if (ignore) return;
        setView({ status: INBOX_STATUS.READY, items: response.data.data, rejectedEmpty: false });
        setPendingCount(response.data.pending_count);
      })
      .catch(() => {
        if (ignore) return;
        setView((previous) => ({
          status: INBOX_STATUS.ERROR,
          items: previous?.items ?? NO_ITEMS,
          rejectedEmpty: false,
        }));
      });

    return () => {
      ignore = true;
    };
  }, [reloadCount, setPendingCount]);

  const reload = () => setReloadCount((count) => count + 1);

  function retry() {
    setView(null);
    reload();
  }

  function removeItem(invitationId: number, rejected: boolean) {
    setView((previous) => {
      if (previous === null) return previous;
      const items = previous.items.filter((entry) => entry.id !== invitationId);
      return { ...previous, items, rejectedEmpty: rejected && items.length === 0 };
    });
  }

  function dismissConfirmation(invitationId: number) {
    setConfirmations((previous) => previous.filter((entry) => entry.invitationId !== invitationId));
    removeItem(invitationId, false);
  }

  async function respond(invitationId: number, action: RespondAction) {
    if (inFlightIds.current.has(invitationId)) return;
    inFlightIds.current.add(invitationId);
    setFailure(null);
    setBusy((previous) => ({ ...previous, [invitationId]: action }));

    try {
      if (action === RESPOND_ACTION.ACCEPT) {
        const { data: organization } = await acceptInvitation(invitationId);
        setConfirmations((previous) => [...previous, { invitationId, organization }]);
        markJoinedOrganization(organization.id);
        reloadOrganizations();
      } else {
        await rejectInvitation(invitationId);
        removeItem(invitationId, true);
      }
      refreshPendingCount();
    } catch (error) {
      const outcome = resolveRespondFailure(error, action);
      setFailure(outcome.message);
      if (outcome.reload) {
        refreshPendingCount();
        reload();
      }
    } finally {
      inFlightIds.current.delete(invitationId);
      setBusy((previous) => {
        const next = { ...previous };
        delete next[invitationId];
        return next;
      });
    }
  }

  return {
    status: view?.status ?? INBOX_STATUS.LOADING,
    items: view?.status === INBOX_STATUS.READY ? view.items : NO_ITEMS,
    rejectedEmpty: view?.status === INBOX_STATUS.READY && view.rejectedEmpty,
    confirmations,
    busy,
    failure,
    retry,
    dismissConfirmation,
    accept: (invitationId: number) => respond(invitationId, RESPOND_ACTION.ACCEPT),
    reject: (invitationId: number) => respond(invitationId, RESPOND_ACTION.REJECT),
  };
}
