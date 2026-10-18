import { InvitationStatus, type InboxInvitation } from "../services/organizations";
import { INVITATION_COPY, RESPOND_ACTION, formatInvitationExpiry, type RespondAction } from "../utils/invitationCopy";
import { organizationInitials, organizationShortName } from "../utils/organization";
import InvitationStatusBadge from "./InvitationStatusBadge";

interface InboxInvitationCardProps {
  invitation: InboxInvitation;
  /** The answer currently in flight for this card, if any. */
  busyAction: RespondAction | null;
  onAccept: () => void;
  onReject: () => void;
}

const InfoCell = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 m-0 mb-1">{label}</p>
    <p className="text-sm text-gray-900 m-0">{value}</p>
  </div>
);

/**
 * One row of the invitee inbox (INV-W9). The status always comes from the
 * server; the client clock is only used to word the "Vence" line. A pending
 * item the caller cannot answer (`can_respond` false) shows no actions.
 */
const InboxInvitationCard = ({ invitation, busyAction, onAccept, onReject }: InboxInvitationCardProps) => {
  const expired = invitation.status === InvitationStatus.EXPIRED;
  const busy = busyAction !== null;
  const accepting = busyAction === RESPOND_ACTION.ACCEPT;
  const rejecting = busyAction === RESPOND_ACTION.REJECT;

  return (
    <article
      className={`rounded-xl border bg-white p-5 ${expired ? "border-gray-200 opacity-80" : "border-leodega-200"}`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
            expired ? "bg-gray-100 text-gray-500" : "bg-leodega-600 text-white"
          }`}
        >
          {organizationInitials(invitation.organization_name)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-leodega-600 m-0 mb-1">
            {INVITATION_COPY.inboxEyebrow}
          </p>
          <h2 className="text-lg font-bold text-gray-900 m-0">{invitation.organization_name}</h2>
          {invitation.invited_by_name && (
            <p className="text-sm text-gray-600 m-0 mt-1">{INVITATION_COPY.inboxInvitedBy(invitation.invited_by_name)}</p>
          )}
        </div>

        <InvitationStatusBadge status={invitation.status} />
      </div>

      {expired ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-700 m-0 mb-1">{INVITATION_COPY.expiredNoticeTitle}</p>
          <p className="text-sm text-gray-600 m-0">
            {INVITATION_COPY.expiredNoticeBody(organizationShortName(invitation.organization_name))}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg bg-leodega-50 px-4 py-3 sm:grid-cols-3">
            <InfoCell label={INVITATION_COPY.inboxRoleLabel} value={INVITATION_COPY.inboxRoleValue} />
            <InfoCell label={INVITATION_COPY.inboxPermissionLabel} value={INVITATION_COPY.inboxPermissionValue} />
            <InfoCell
              label={INVITATION_COPY.inboxExpiresLabel}
              value={formatInvitationExpiry(invitation.expires_at)}
            />
          </div>

          {invitation.can_respond && (
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejecting ? INVITATION_COPY.rejecting : INVITATION_COPY.rejectInvitation}
              </button>
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="rounded-lg bg-leodega-600 px-4 py-2 text-sm font-semibold text-white hover:bg-leodega-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accepting ? INVITATION_COPY.accepting : INVITATION_COPY.acceptInvitation}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
};

export default InboxInvitationCard;
