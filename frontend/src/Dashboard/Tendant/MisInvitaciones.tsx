import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import AcceptedInvitationCard from "../../Components/AcceptedInvitationCard";
import HeaderTendant from "../../Components/HeaderTendant";
import InboxEmptyState from "../../Components/InboxEmptyState";
import { EMPTY_VARIANT } from "../../Components/inboxEmptyVariant";
import InboxInvitationCard from "../../Components/InboxInvitationCard";
import { useActiveContext } from "../../context/useActiveContext";
import { INBOX_STATUS, useMyInvitations } from "../../hooks/useMyInvitations";
import { INVITATION_COPY } from "../../utils/invitationCopy";

const TENANT_HOME_PATH = "/arrendatario/dashboard";

const PageShell = ({ children }: { children: ReactNode }) => (
  <>
    <HeaderTendant />
    <div className="px-8 py-7 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">{INVITATION_COPY.inboxTitle}</h1>
        <p className="text-sm text-gray-600 m-0 mb-6">{INVITATION_COPY.inboxSubtitle}</p>
        {children}
      </div>
    </div>
  </>
);

/**
 * Container for `/mi-cuenta/invitaciones` (huc-14 INV-W9): the invitee inbox.
 * It lists the invitations addressed to the signed-in account, whatever the
 * active context is, in the order the server sent them.
 */
const MisInvitaciones = () => {
  const inbox = useMyInvitations();
  const { activateOrganization, selectPersonal } = useActiveContext();
  const navigate = useNavigate();
  const confirmationIds = new Set(inbox.confirmations.map((entry) => entry.invitationId));
  const listedIds = new Set(inbox.items.map((entry) => entry.id));
  // A reload can stop listing an accepted invitation; its confirmation stays
  // on screen, first, until the user answers it.
  const orphanConfirmations = inbox.confirmations.filter((entry) => !listedIds.has(entry.invitationId));
  const empty = inbox.items.length === 0 && inbox.confirmations.length === 0;

  function renderConfirmation(invitationId: number) {
    const confirmation = inbox.confirmations.find((entry) => entry.invitationId === invitationId);
    if (confirmation === undefined) return null;

    return (
      <AcceptedInvitationCard
        key={`joined-${invitationId}`}
        organization={confirmation.organization}
        onStayPersonal={() => {
          selectPersonal();
          inbox.dismissConfirmation(invitationId);
        }}
        onOperateAs={() => {
          activateOrganization(confirmation.organization);
          navigate(TENANT_HOME_PATH);
        }}
      />
    );
  }

  return (
    <PageShell>
      {inbox.status === INBOX_STATUS.LOADING && (
        <p className="text-sm text-gray-500 m-0">{INVITATION_COPY.listLoading}</p>
      )}

      {inbox.status === INBOX_STATUS.ERROR && (
        <div className="flex items-center gap-4">
          <p className="text-sm text-red-600 m-0" role="alert">
            {INVITATION_COPY.listError}
          </p>
          <button
            type="button"
            onClick={inbox.retry}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {INVITATION_COPY.inboxRetry}
          </button>
        </div>
      )}

      {inbox.failure !== null && (
        <p className="text-sm text-red-600 m-0 mb-4" role="alert">
          {inbox.failure}
        </p>
      )}

      {inbox.status === INBOX_STATUS.READY && empty && (
        <InboxEmptyState variant={inbox.rejectedEmpty ? EMPTY_VARIANT.REJECTED : EMPTY_VARIANT.PLAIN} />
      )}

      {inbox.status === INBOX_STATUS.READY && !empty && (
        <div className="flex flex-col gap-4">
          {orphanConfirmations.map((entry) => renderConfirmation(entry.invitationId))}
          {inbox.items.map((invitation) =>
            confirmationIds.has(invitation.id) ? (
              renderConfirmation(invitation.id)
            ) : (
              <InboxInvitationCard
                key={invitation.id}
                invitation={invitation}
                busyAction={inbox.busy[invitation.id] ?? null}
                onAccept={() => inbox.accept(invitation.id)}
                onReject={() => inbox.reject(invitation.id)}
              />
            ),
          )}
        </div>
      )}
    </PageShell>
  );
};

export default MisInvitaciones;
