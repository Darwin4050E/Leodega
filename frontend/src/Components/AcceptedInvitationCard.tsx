import type { Organization } from "../services/organizations";
import { INVITATION_COPY } from "../utils/invitationCopy";
import { organizationInitials, organizationShortName } from "../utils/organization";

interface AcceptedInvitationCardProps {
  /** The organization returned by the accept call, so this works before the list reloads. */
  organization: Organization;
  onStayPersonal: () => void;
  onOperateAs: () => void;
}

/**
 * Confirmation that replaces an accepted invitation card (INV-W11). It never
 * changes the active context by itself: the user picks one of the two buttons.
 */
const AcceptedInvitationCard = ({ organization, onStayPersonal, onOperateAs }: AcceptedInvitationCardProps) => {
  const shortName = organizationShortName(organization.name);
  const body = INVITATION_COPY.joinedBody(organization.name);

  return (
    <section role="status" className="rounded-xl border border-green-200 bg-green-50 p-5">
      <h2 className="text-lg font-bold text-gray-900 m-0 mb-1">{INVITATION_COPY.joinedTitle(shortName)}</h2>
      <p className="text-sm text-gray-700 m-0">
        {body.lead}
        <b>{body.name}</b>
        {body.tail}
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-200 bg-white px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leodega-600 text-sm font-bold text-white"
        >
          {organizationInitials(organization.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 m-0">{organization.name}</p>
          <p className="text-xs text-gray-600 m-0">{INVITATION_COPY.joinedRole}</p>
        </div>
        <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          {INVITATION_COPY.joinedBadge}
        </span>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onStayPersonal}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {INVITATION_COPY.stayPersonal}
        </button>
        <button
          type="button"
          onClick={onOperateAs}
          className="rounded-lg bg-leodega-600 px-4 py-2 text-sm font-semibold text-white hover:bg-leodega-700"
        >
          {INVITATION_COPY.operateAs(shortName)}
        </button>
      </div>
    </section>
  );
};

export default AcceptedInvitationCard;
