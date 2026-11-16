import { INVITATION_COPY } from "../utils/invitationCopy";
import { EMPTY_VARIANT, type EmptyVariant } from "./inboxEmptyVariant";

interface InboxEmptyStateProps {
  variant: EmptyVariant;
}

const InboxEmptyState = ({ variant }: InboxEmptyStateProps) => {
  const rejected = variant === EMPTY_VARIANT.REJECTED;

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-gray-900 m-0 mb-1">
        {rejected ? INVITATION_COPY.rejectedEmptyTitle : INVITATION_COPY.emptyTitle}
      </h2>
      <p className="text-sm text-gray-600 m-0">
        {rejected ? INVITATION_COPY.rejectedEmptyBody : INVITATION_COPY.emptyBody}
      </p>
    </div>
  );
};

export default InboxEmptyState;
