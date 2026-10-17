import { Mail } from "lucide-react";

import { INVITATIONS_STATUS, type InvitationsStatus } from "../hooks/useOrganizationInvitations";
import { InvitationStatus, type OrganizationInvitation } from "../services/organizations";
import { formatInvitationDate, INVITATION_COPY } from "../utils/invitationCopy";
import InvitationStatusBadge from "./InvitationStatusBadge";

interface InvitationsListProps {
  status: InvitationsStatus;
  items: OrganizationInvitation[];
  page: number;
  lastPage: number;
  total: number;
  pendingCount: number;
  revokingId: number | null;
  onRevoke: (invitationId: number) => void;
  onPageChange: (page: number) => void;
}

// The server decides what is pending and revocable; the dates are display only.
function rowMeta(invitation: OrganizationInvitation): string {
  const parts = [INVITATION_COPY.sentOn(formatInvitationDate(invitation.created_at))];
  if (invitation.status === InvitationStatus.PENDING) {
    parts.push(INVITATION_COPY.expiresOn(formatInvitationDate(invitation.expires_at)));
  }
  if (invitation.invited_by_name !== null) parts.push(INVITATION_COPY.invitedBy(invitation.invited_by_name));
  return parts.join(" · ");
}

const PAGE_BUTTON_CLASS =
  "px-3 py-1.5 text-sm font-semibold text-leodega-600 bg-white border border-gray-200 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Presentational invitation list (hue-01 INV-W3..W5): heading with counter,
 * loading / empty / error states, one row per invitation in the server order,
 * and the pagination controls. All actions are reported upward.
 */
const InvitationsList = ({
  status,
  items,
  page,
  lastPage,
  total,
  pendingCount,
  revokingId,
  onRevoke,
  onPageChange,
}: InvitationsListProps) => {
  const ready = status === INVITATIONS_STATUS.READY;

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 m-0">{INVITATION_COPY.listHeading}</h2>
        {ready && <span className="text-sm text-gray-500">{INVITATION_COPY.counter(pendingCount, total)}</span>}
      </div>

      {status === INVITATIONS_STATUS.LOADING && (
        <p className="text-sm text-gray-500 m-0">{INVITATION_COPY.listLoading}</p>
      )}

      {status === INVITATIONS_STATUS.ERROR && (
        <p className="text-sm text-red-600 m-0" role="alert">
          {INVITATION_COPY.listError}
        </p>
      )}

      {ready && total === 0 && (
        <p className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-sm text-gray-500 m-0">
          {INVITATION_COPY.listEmpty}
        </p>
      )}

      {ready && items.length > 0 && (
        <ul className="bg-white rounded-xl border border-gray-200 overflow-hidden list-none m-0 p-0">
          {items.map((invitation) => (
            <li key={invitation.id} className="flex items-center gap-3.5 px-4 py-3.5 border-t border-gray-100 first:border-t-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leodega-50 text-leodega-600">
                <Mail size={17} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 m-0 truncate">{invitation.email}</p>
                <p className="text-xs text-gray-500 m-0 mt-0.5">{rowMeta(invitation)}</p>
              </div>
              <InvitationStatusBadge status={invitation.status} />
              {invitation.can_be_revoked && (
                <button
                  type="button"
                  disabled={revokingId === invitation.id}
                  onClick={() => onRevoke(invitation.id)}
                  className="text-sm font-semibold text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {revokingId === invitation.id ? INVITATION_COPY.revoking : INVITATION_COPY.revoke}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && status !== INVITATIONS_STATUS.IDLE && (
        <nav className="flex items-center justify-center gap-3 mt-4">
          <button type="button" className={PAGE_BUTTON_CLASS} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {INVITATION_COPY.previousPage}
          </button>
          <span className="text-sm text-gray-600">{INVITATION_COPY.pageOf(page, lastPage)}</span>
          <button
            type="button"
            className={PAGE_BUTTON_CLASS}
            disabled={page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            {INVITATION_COPY.nextPage}
          </button>
        </nav>
      )}
    </section>
  );
};

export default InvitationsList;
