import { useEffect, useState, type ReactNode } from "react";

import HeaderTendant from "../../Components/HeaderTendant";
import InvitationsList from "../../Components/InvitationsList";
import InviteMemberForm from "../../Components/InviteMemberForm";
import { useActiveContext } from "../../context/useActiveContext";
import {
  INVITATIONS_STATUS,
  SUBMIT_STATUS,
  useOrganizationInvitations,
} from "../../hooks/useOrganizationInvitations";
import { INVITATION_COPY } from "../../utils/invitationCopy";
import { NOTICE_TONE, type InviteNotice } from "../../utils/inviteNotice";

const TOAST_DURATION_MS = 5000;

// Deliberately loose: the server owns the real validation and answers with its own text.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string | null {
  if (email === "") return INVITATION_COPY.blankEmail;
  return EMAIL_PATTERN.test(email) ? null : INVITATION_COPY.invalidEmail;
}

const PageShell = ({ children }: { children: ReactNode }) => (
  <>
    <HeaderTendant />
    <div className="px-8 py-7 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  </>
);

const MemberView = () => (
  <div className="rounded-xl border border-leodega-200 bg-leodega-50 px-4 py-3.5">
    <p className="text-sm font-semibold text-leodega-700 m-0 mb-1">{INVITATION_COPY.memberViewTitle}</p>
    <p className="text-sm text-gray-700 m-0">{INVITATION_COPY.memberViewBody}</p>
  </div>
);

interface AdminPanelProps {
  organizationId: number;
  organizationName: string;
}

/**
 * Invite form plus invitation list for one organization. Mounted with the
 * organization id as its key, so the typed email, the notices and the toast
 * never leak into another organization.
 */
const AdminPanel = ({ organizationId, organizationName }: AdminPanelProps) => {
  const invitations = useOrganizationInvitations(organizationId);
  const [value, setValue] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [clientNotice, setClientNotice] = useState<InviteNotice | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const { submit } = invitations;
  const submitting = submit.status === SUBMIT_STATUS.SUBMITTING;

  function handleChange(next: string) {
    setValue(next);
    setClientNotice(null);
    if (!submitting) invitations.resetSubmit();
  }

  async function handleSubmit() {
    const email = value.trim();
    const problem = validateEmail(email);
    if (problem !== null) {
      invitations.resetSubmit();
      setClientNotice({ tone: NOTICE_TONE.ERROR, title: INVITATION_COPY.clientNoticeTitle, body: problem });
      return;
    }

    setClientNotice(null);
    setSentEmail(email);
    if (await invitations.invite(email)) {
      setValue("");
      setToast(INVITATION_COPY.successToast(email));
    }
  }

  async function handleRevoke(invitationId: number) {
    if (await invitations.revoke(invitationId)) setToast(INVITATION_COPY.revokedToast);
  }

  let notice: InviteNotice | null = clientNotice;
  if (notice === null && submit.status === SUBMIT_STATUS.SUCCESS) {
    notice = {
      tone: NOTICE_TONE.SUCCESS,
      title: INVITATION_COPY.successTitle,
      body: INVITATION_COPY.successBody(sentEmail),
    };
  } else if (notice === null && submit.status === SUBMIT_STATUS.ERROR && submit.message !== null) {
    // The generic send error is a complete sentence on its own; any other
    // message is a deliberate refusal and is shown under the refusal title.
    notice =
      submit.message === INVITATION_COPY.sendError
        ? { tone: NOTICE_TONE.ERROR, title: submit.message }
        : { tone: NOTICE_TONE.ERROR, title: INVITATION_COPY.refusalTitle, body: submit.message };
  }

  if (invitations.status === INVITATIONS_STATUS.FORBIDDEN) return <MemberView />;

  return (
    <>
      <InviteMemberForm
        organizationName={organizationName}
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitting={submitting}
        notice={notice}
      />

      {invitations.revokeMessage && (
        <p className="text-sm text-red-600 m-0 mt-4" role="alert">
          {invitations.revokeMessage}
        </p>
      )}

      <InvitationsList
        status={invitations.status}
        items={invitations.items}
        page={invitations.page}
        lastPage={invitations.lastPage}
        total={invitations.total}
        pendingCount={invitations.pendingCount}
        revokingId={invitations.revokingId}
        onRevoke={handleRevoke}
        onPageChange={invitations.goToPage}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2300] bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-lg shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
};

/**
 * Container for `/organizacion/miembros` (hue-01 INV-W1): admins of the active
 * organization invite clients by email and see the invitations they sent.
 * The cached role only decides what to render first; a 403 from the server
 * (handled in the hook) is what finally switches the page to the member view.
 */
const MiembrosOrganizacion = () => {
  const { activeOrganization } = useActiveContext();

  if (activeOrganization === null) {
    return (
      <PageShell>
        <p className="text-sm text-gray-500 m-0">{INVITATION_COPY.noOrganization}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {activeOrganization.role === "admin" ? (
        <AdminPanel
          key={activeOrganization.id}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      ) : (
        <MemberView />
      )}
    </PageShell>
  );
};

export default MiembrosOrganizacion;
