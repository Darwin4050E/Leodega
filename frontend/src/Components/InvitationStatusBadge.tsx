import { InvitationStatus } from "../services/organizations";
import { INVITATION_COPY } from "../utils/invitationCopy";

const TONE_CLASS = {
  [InvitationStatus.PENDING]: "bg-amber-50 text-amber-700",
  [InvitationStatus.ACCEPTED]: "bg-green-50 text-green-700",
  [InvitationStatus.REJECTED]: "bg-red-50 text-red-700",
  [InvitationStatus.EXPIRED]: "bg-gray-100 text-gray-600",
  [InvitationStatus.CANCELLED]: "bg-gray-100 text-gray-600",
} satisfies Record<InvitationStatus, string>;

interface InvitationStatusBadgeProps {
  status: InvitationStatus;
}

const InvitationStatusBadge = ({ status }: InvitationStatusBadgeProps) => (
  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${TONE_CLASS[status]}`}>
    {INVITATION_COPY.statusLabel[status]}
  </span>
);

export default InvitationStatusBadge;
