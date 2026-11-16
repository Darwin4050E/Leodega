import { useId } from "react";
import { Link } from "react-router-dom";

import { PANEL_STATUS, type PanelStatus } from "../hooks/useOrganizationPanel";
import type { PanelMember } from "../services/organizations";
import { formatInvitationDate } from "../utils/invitationCopy";
import { formatUSD } from "../utils/money";
import { PANEL_COPY } from "../utils/panelCopy";

interface PanelMembersTableProps {
  status: PanelStatus;
  members: PanelMember[] | null;
  isAdmin: boolean;
  onRetry: () => void;
}

const HEADER_CELL_CLASS = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap";
const LINK_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 no-underline hover:bg-gray-50";

// A limit of zero cannot be divided by: any spending is then fully over it.
function usagePercent(spent: string, limit: string): number {
  const cap = Number(limit);
  const used = Number(spent);
  if (cap <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / cap) * 100);
}

function barTone(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-leodega-600";
}

const NameCell = ({ member }: { member: PanelMember }) => {
  // Absent keys render nothing: the web never infers data the server hid.
  const meta = [member.email, member.joined_at !== null ? PANEL_COPY.since(formatInvitationDate(member.joined_at)) : ""]
    .filter((part): part is string => part !== undefined && part !== "")
    .join(" · ");

  return (
    <td className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-900">{member.name}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            member.role === "admin" ? "bg-leodega-50 text-leodega-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {member.role === "admin" ? PANEL_COPY.adminBadge : PANEL_COPY.memberBadge}
        </span>
        {member.is_self && <span className="text-xs text-gray-400">{PANEL_COPY.selfMarker}</span>}
      </div>
      {meta !== "" && <p className="m-0 mt-0.5 text-xs text-gray-500">{meta}</p>}
    </td>
  );
};

const SpendCells = ({ limit, spent }: { limit: string | null; spent: string }) => {
  if (limit === null) {
    return (
      <>
        <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">{PANEL_COPY.noLimit}</td>
        <td className="px-4 py-3.5 text-sm">
          <span className="font-semibold text-gray-900">{formatUSD(spent, { fixed: true })}</span>{" "}
          <span className="text-gray-400">{PANEL_COPY.unlimitedSpent}</span>
        </td>
      </>
    );
  }

  const percent = usagePercent(spent, limit);
  const formattedLimit = formatUSD(limit, { fixed: true });

  return (
    <>
      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
        {PANEL_COPY.limitPerMonth(formattedLimit)}
      </td>
      <td className="min-w-52 px-4 py-3.5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold text-gray-900">
            {PANEL_COPY.spentOfLimit(formatUSD(spent, { fixed: true }), formattedLimit)}
          </span>
          <span className="font-semibold text-gray-600">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(percent, 100)}
            aria-label={PANEL_COPY.spentColumn}
            className={`h-full rounded-full ${barTone(percent)}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </td>
    </>
  );
};

const MemberRow = ({ member }: { member: PanelMember }) => (
  <tr className="border-t border-gray-100">
    <NameCell member={member} />
    {member.monthly_limit !== undefined && member.spent !== undefined ? (
      <SpendCells limit={member.monthly_limit} spent={member.spent} />
    ) : (
      <td colSpan={2} />
    )}
  </tr>
);

/**
 * Members of the active organization (hue-03 PAN-W7). It renders exactly the
 * keys the server sent: email, limit and consumed are absent for the rows a
 * member may not see, and an absent key leaves its cell empty rather than a
 * dash or a zero. Read-only: the links only navigate to the pages that edit.
 */
const PanelMembersTable = ({ status, members, isAdmin, onRetry }: PanelMembersTableProps) => {
  const headingId = useId();

  if (status === PANEL_STATUS.IDLE || status === PANEL_STATUS.FORBIDDEN) return null;

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="m-0 text-base font-semibold text-gray-900">
            {PANEL_COPY.membersTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-gray-500">
            {isAdmin ? PANEL_COPY.membersSubtitleAdmin : PANEL_COPY.membersSubtitleMember}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link to="/organizacion/miembros" className={LINK_CLASS}>
              {PANEL_COPY.inviteLink}
            </Link>
            <Link to="/organizacion/billetera" className={LINK_CLASS}>
              {PANEL_COPY.manageLimitsLink}
            </Link>
          </div>
        )}
      </div>

      {status === PANEL_STATUS.LOADING && (
        <p role="status" className="m-0 px-5 pb-5 text-sm text-gray-500">
          {PANEL_COPY.loading}
        </p>
      )}

      {status === PANEL_STATUS.ERROR && (
        <div className="flex items-center gap-4 px-5 pb-5">
          <p role="alert" className="m-0 text-sm text-red-600">
            {PANEL_COPY.membersError}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {PANEL_COPY.retry}
          </button>
        </div>
      )}

      {status === PANEL_STATUS.READY && members !== null && members.length > 0 && (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className={HEADER_CELL_CLASS}>
                  {PANEL_COPY.memberColumn}
                </th>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  {PANEL_COPY.limitColumn}
                </th>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  {PANEL_COPY.spentColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow key={member.user_id} member={member} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PanelMembersTable;
