import type { ReactNode } from "react";

import HeaderTendant from "../../Components/HeaderTendant";
import PanelMembersTable from "../../Components/PanelMembersTable";
import PanelReservationsTable from "../../Components/PanelReservationsTable";
import PanelSummaryCards from "../../Components/PanelSummaryCards";
import PanelWalletSummary from "../../Components/PanelWalletSummary";
import { useActiveContext } from "../../context/useActiveContext";
import { PANEL_STATUS, usePanelMembers, usePanelReservations, usePanelSummary } from "../../hooks/useOrganizationPanel";
import type { Organization } from "../../services/organizations";
import { ORGANIZATION_FORBIDDEN_MESSAGE } from "../../utils/activeContext";
import { organizationInitials, organizationShortName } from "../../utils/organization";
import { PANEL_COPY } from "../../utils/panelCopy";

const PageShell = ({ shortName, children }: { shortName?: string; children: ReactNode }) => (
  <>
    <HeaderTendant />
    <div className="px-8 py-7 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">{PANEL_COPY.title}</h1>
        {shortName !== undefined && <p className="text-sm text-gray-600 m-0 mb-6">{PANEL_COPY.subtitle(shortName)}</p>}
        {children}
      </div>
    </div>
  </>
);

const OrganizationMark = ({ organization }: { organization: Organization }) =>
  organization.logo ? (
    <img
      src={organization.logo}
      alt={`Logo de ${organization.name}`}
      className="size-[52px] shrink-0 rounded-2xl border border-gray-200 object-cover"
    />
  ) : (
    <div
      aria-hidden="true"
      className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-leodega-50 text-lg font-semibold text-leodega-700"
    >
      {organizationInitials(organization.name)}
    </div>
  );

interface PanelHeaderProps {
  organization: Organization;
  isAdmin: boolean;
}

const PanelHeader = ({ organization, isAdmin }: PanelHeaderProps) => (
  <div className="flex flex-wrap items-center gap-4 pb-6 mb-6 border-b border-gray-200">
    <OrganizationMark organization={organization} />
    <div className="flex-1 min-w-0">
      <p className="text-xl font-semibold text-gray-900 m-0 mb-1 truncate">{organization.name}</p>
      <p className="flex flex-wrap gap-x-3 text-sm text-gray-500 m-0">
        <span>{PANEL_COPY.ruc(organization.ruc)}</span>
        <span>{organization.email}</span>
      </p>
    </div>
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        isAdmin ? "bg-leodega-50 text-leodega-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isAdmin ? PANEL_COPY.adminBadge : PANEL_COPY.memberBadge}
    </span>
  </div>
);

const MemberNotice = () => (
  <div role="note" className="mb-6 rounded-xl border border-leodega-200 bg-leodega-50 px-4 py-3.5">
    <p className="text-sm font-semibold text-leodega-700 m-0 mb-1">{PANEL_COPY.memberNoticeTitle}</p>
    <p className="text-sm text-gray-700 m-0">{PANEL_COPY.memberNoticeBody}</p>
  </div>
);

/**
 * Container for `/organizacion/panel` (hue-03 PAN-W1): a read-only hub for the
 * active organization. The cached role is only the first-render hint; once the
 * summary arrives its `role` decides what the page shows (A11). No section keeps
 * state from another organization (WS10): the hook tags its state with it.
 */
const PanelOrganizacion = () => {
  const { activeOrganization } = useActiveContext();
  const summary = usePanelSummary(activeOrganization?.id ?? null);
  const members = usePanelMembers(activeOrganization?.id ?? null);
  const reservations = usePanelReservations(activeOrganization?.id ?? null);

  if (activeOrganization === null) {
    return (
      <PageShell>
        <p className="text-sm text-gray-500 m-0">{PANEL_COPY.noOrganization}</p>
      </PageShell>
    );
  }

  if (summary.status === PANEL_STATUS.FORBIDDEN) {
    return (
      <PageShell>
        <p role="alert" className="text-sm text-red-600 m-0">
          {summary.message ?? ORGANIZATION_FORBIDDEN_MESSAGE}
        </p>
      </PageShell>
    );
  }

  const isAdmin = (summary.data?.role ?? activeOrganization.role) === "admin";

  return (
    <PageShell shortName={organizationShortName(activeOrganization.name)}>
      <PanelHeader organization={activeOrganization} isAdmin={isAdmin} />
      {!isAdmin && <MemberNotice />}
      <PanelSummaryCards status={summary.status} summary={summary.data} onRetry={summary.reload} />
      <PanelWalletSummary organizationId={activeOrganization.id} />
      <PanelMembersTable status={members.status} members={members.data} isAdmin={isAdmin} onRetry={members.reload} />
      <PanelReservationsTable
        status={reservations.status}
        reservations={reservations.data}
        isAdmin={isAdmin}
        page={reservations.page}
        onPageChange={reservations.goToPage}
        onRetry={reservations.reload}
      />
    </PageShell>
  );
};

export default PanelOrganizacion;
