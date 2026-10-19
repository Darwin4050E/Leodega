import { Calendar, Mail, User, type LucideIcon } from "lucide-react";

import { PANEL_STATUS, type PanelStatus } from "../hooks/useOrganizationPanel";
import type { PanelSummary } from "../services/organizations";
import { PANEL_COPY } from "../utils/panelCopy";

interface PanelSummaryCardsProps {
  status: PanelStatus;
  summary: PanelSummary | null;
  onRetry: () => void;
}

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  sub: string;
}

const SummaryCard = ({ icon: Icon, label, value, sub }: SummaryCardProps) => (
  <div role="group" aria-label={label} className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
      <Icon size={15} className="text-gray-400" aria-hidden="true" />
    </div>
    <p className="m-0 mt-4 text-3xl font-semibold leading-none text-gray-900">{value}</p>
    <p className="m-0 mt-2 text-xs text-gray-500">{sub}</p>
  </div>
);

/**
 * Presentational summary cards (hue-03 PAN-W5). The cards come from what the
 * summary carries: the pending-invitations card appears only when the server
 * sent that count (admins), so a member view never shows a card at zero.
 */
const PanelSummaryCards = ({ status, summary, onRetry }: PanelSummaryCardsProps) => {
  if (status === PANEL_STATUS.LOADING) {
    return (
      <p role="status" className="m-0 text-sm text-gray-500">
        {PANEL_COPY.loading}
      </p>
    );
  }

  if (status === PANEL_STATUS.ERROR) {
    return (
      <div className="flex items-center gap-4">
        <p role="alert" className="m-0 text-sm text-red-600">
          {PANEL_COPY.summaryError}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {PANEL_COPY.retry}
        </button>
      </div>
    );
  }

  if (status !== PANEL_STATUS.READY || summary === null) return null;

  const isMember = summary.role === "member";

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      <SummaryCard
        icon={User}
        label={PANEL_COPY.membersLabel}
        value={summary.members_count}
        sub={PANEL_COPY.membersSub}
      />
      <SummaryCard
        icon={Calendar}
        label={PANEL_COPY.reservationsLabel}
        value={summary.active_reservations_count}
        sub={isMember ? PANEL_COPY.reservationsSubMember : PANEL_COPY.reservationsSubAdmin}
      />
      {summary.pending_invitations_count !== undefined && (
        <SummaryCard
          icon={Mail}
          label={PANEL_COPY.pendingLabel}
          value={summary.pending_invitations_count}
          sub={PANEL_COPY.pendingSub}
        />
      )}
    </div>
  );
};

export default PanelSummaryCards;
