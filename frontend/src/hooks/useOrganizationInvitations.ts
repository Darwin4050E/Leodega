import { useEffect, useRef, useState } from "react";
import { asApiError } from "../api/errors";
import {
  getInvitations,
  inviteMember,
  revokeInvitation,
  type OrganizationInvitation,
  type PaginatedInvitations,
} from "../services/organizations";
import { INVITATION_COPY, INVITATION_FAILURE, resolveInvitationFailure } from "../utils/invitationCopy";

export const INVITATIONS_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
  /** The server refused the caller (not an admin): the page shows the member view. */
  FORBIDDEN: "forbidden",
} as const;

export type InvitationsStatus = (typeof INVITATIONS_STATUS)[keyof typeof INVITATIONS_STATUS];

export const SUBMIT_STATUS = {
  IDLE: "idle",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type SubmitStatus = (typeof SUBMIT_STATUS)[keyof typeof SUBMIT_STATUS];

interface SubmitState {
  status: SubmitStatus;
  message: string | null;
}

const IDLE_SUBMIT: SubmitState = { status: SUBMIT_STATUS.IDLE, message: null };

// What one fetch settled to, tagged with the request it answered so a view of
// another organization or page is never shown as the current one.
interface ListView {
  organizationId: number;
  page: number;
  status: typeof INVITATIONS_STATUS.READY | typeof INVITATIONS_STATUS.ERROR | typeof INVITATIONS_STATUS.FORBIDDEN;
  /** Last paginator received for this organization; survives a failed page change. */
  data: PaginatedInvitations | null;
}

const EMPTY_ITEMS: OrganizationInvitation[] = [];

/**
 * Invitations of one organization (hue-01 INV-W1..W5). `null` means personal
 * mode or a non-admin caller: no request is issued. State is tagged with its
 * organization and a late response is dropped by the effect cleanup (WS47);
 * switching organization returns to page 1 and clears the previous outcomes
 * (WS48). `invite` returns to page 1 and `revoke` reloads the current page.
 * Both resolve to whether the server accepted the action; the failure text is
 * in `submit.message` / `revokeMessage`, and a 403 flips `status` to
 * `forbidden` (the server stays authoritative over the cached role).
 */
export function useOrganizationInvitations(organizationId: number | null) {
  const [trackedOrganizationId, setTrackedOrganizationId] = useState(organizationId);
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [view, setView] = useState<ListView | null>(null);
  const [submitState, setSubmitState] = useState<(SubmitState & { organizationId: number }) | null>(null);
  const [revoking, setRevoking] = useState<{ organizationId: number; id: number } | null>(null);
  const [revokeFeedback, setRevokeFeedback] = useState<{ organizationId: number; message: string } | null>(null);
  // Synchronous guards: state is not updated yet when a double click lands.
  const inviteBusy = useRef(false);
  const revokeBusy = useRef(false);

  if (trackedOrganizationId !== organizationId) {
    setTrackedOrganizationId(organizationId);
    setPage(1);
    setSubmitState(null);
    setRevoking(null);
    setRevokeFeedback(null);
  }

  useEffect(() => {
    if (organizationId === null) return;
    let ignore = false;

    getInvitations(organizationId, page)
      .then((response) => {
        if (ignore) return;
        setView({ organizationId, page, status: INVITATIONS_STATUS.READY, data: response.data });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        const forbidden = resolveInvitationFailure(error, "").kind === INVITATION_FAILURE.FORBIDDEN;
        setView((previous) => ({
          organizationId,
          page,
          status: forbidden ? INVITATIONS_STATUS.FORBIDDEN : INVITATIONS_STATUS.ERROR,
          data: previous?.organizationId === organizationId ? previous.data : null,
        }));
      });

    return () => {
      ignore = true;
    };
  }, [organizationId, page, reloadCount]);

  const current = organizationId !== null && view?.organizationId === organizationId ? view : null;
  const status: InvitationsStatus =
    organizationId === null
      ? INVITATIONS_STATUS.IDLE
      : current?.status === INVITATIONS_STATUS.FORBIDDEN
        ? INVITATIONS_STATUS.FORBIDDEN
        : current !== null && current.page === page
          ? current.status
          : INVITATIONS_STATUS.LOADING;
  

  const reload = () => setReloadCount((count) => count + 1);
  const markForbidden = (id: number) =>
    setView({ organizationId: id, page, status: INVITATIONS_STATUS.FORBIDDEN, data: null });

  async function invite(email: string): Promise<boolean> {
    if (organizationId === null || inviteBusy.current) return false;
    inviteBusy.current = true;
    setSubmitState({ organizationId, status: SUBMIT_STATUS.SUBMITTING, message: null });

    try {
      await inviteMember(organizationId, email);
      setSubmitState({ organizationId, status: SUBMIT_STATUS.SUCCESS, message: null });
      setPage(1);
      reload();
      return true;
    } catch (error) {
      const failure = resolveInvitationFailure(error, INVITATION_COPY.sendError);
      if (failure.kind === INVITATION_FAILURE.FORBIDDEN) {
        setSubmitState(null);
        markForbidden(organizationId);
      } else {
        setSubmitState({ organizationId, status: SUBMIT_STATUS.ERROR, message: failure.message });
      }
      return false;
    } finally {
      inviteBusy.current = false;
    }
  }

  async function revoke(invitationId: number): Promise<boolean> {
    if (organizationId === null || revokeBusy.current) return false;
    revokeBusy.current = true;
    setRevoking({ organizationId, id: invitationId });
    setRevokeFeedback(null);

    try {
      await revokeInvitation(organizationId, invitationId);
      reload();
      return true;
    } catch (error) {
      const failure = resolveInvitationFailure(error, INVITATION_COPY.revokeError);
      if (failure.kind === INVITATION_FAILURE.FORBIDDEN) {
        markForbidden(organizationId);
      } else {
        setRevokeFeedback({ organizationId, message: failure.message });
        // The row changed under us (already answered, or gone): show the truth.
        const httpStatus = asApiError(error).response?.status;
        if (httpStatus === 404 || httpStatus === 409) reload();
      }
      return false;
    } finally {
      revokeBusy.current = false;
      setRevoking(null);
    }
  }

  const submit = submitState?.organizationId === organizationId ? submitState : IDLE_SUBMIT;

  return {
    status,
    items: status === INVITATIONS_STATUS.READY ? (current?.data?.data ?? EMPTY_ITEMS) : EMPTY_ITEMS,
    page,
    lastPage: current?.data?.last_page ?? 1,
    total: current?.data?.total ?? 0,
    pendingCount: current?.data?.pending_count ?? 0,
    submit: { status: submit.status, message: submit.message },
    revokingId: revoking?.organizationId === organizationId ? revoking.id : null,
    revokeMessage: revokeFeedback?.organizationId === organizationId ? revokeFeedback.message : null,
    goToPage: (nextPage: number) => setPage(nextPage),
    resetSubmit: () => setSubmitState(null),
    invite,
    revoke,
  };
}
