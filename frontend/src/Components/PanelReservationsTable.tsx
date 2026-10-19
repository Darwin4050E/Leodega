import { useId } from "react";
import { Link } from "react-router-dom";

import { PANEL_STATUS, type PanelStatus } from "../hooks/useOrganizationPanel";
import {
  PANEL_RESERVATION_STATUS,
  type PaginatedPanelReservations,
  type PanelReservation,
} from "../services/organizations";
import { formatUSD } from "../utils/money";
import { formatPeriodDay } from "../utils/panelFormat";
import { PANEL_COPY } from "../utils/panelCopy";
import PanelPagination from "./PanelPagination";

interface PanelReservationsTableProps {
  status: PanelStatus;
  reservations: PaginatedPanelReservations | null;
  isAdmin: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

const HEADER_CELL_CLASS = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap";
const CELL_CLASS = "px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap";
const LINK_CLASS =
  "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 no-underline hover:bg-gray-50";

// The total and the wallet flag are always sent today, but the web renders only
// what exists: an absent key is a dash, never NaN or "$undefined".
function amountOrDash(total: string | undefined): string {
  return total === undefined ? PANEL_COPY.hiddenAmount : formatUSD(total, { fixed: true });
}

function paidCell(row: PanelReservation): string {
  if (row.paid_with_wallet === undefined) return PANEL_COPY.hiddenAmount;
  return row.paid_with_wallet ? amountOrDash(row.total) : PANEL_COPY.paidByCard;
}

const StatusBadge = ({ status }: { status: PanelReservation["status"] }) => {
  const pending = status === PANEL_RESERVATION_STATUS.PENDING;

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        pending ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
      }`}
    >
      {pending ? PANEL_COPY.statusPending : PANEL_COPY.statusActive}
    </span>
  );
};

const ReservationRow = ({ row }: { row: PanelReservation }) => (
  <tr className="border-t border-gray-100">
    <td className={`${CELL_CLASS} font-semibold text-gray-900`}>{row.warehouse_name ?? PANEL_COPY.hiddenAmount}</td>
    <td className={CELL_CLASS}>{row.member_name ?? PANEL_COPY.hiddenAmount}</td>
    <td className={CELL_CLASS}>{PANEL_COPY.period(formatPeriodDay(row.start_date), formatPeriodDay(row.end_date))}</td>
    <td className={`${CELL_CLASS} font-semibold text-gray-900`}>{amountOrDash(row.total)}</td>
    <td className={CELL_CLASS}>{paidCell(row)}</td>
    <td className={CELL_CLASS}>
      <StatusBadge status={row.status} />
    </td>
  </tr>
);

/**
 * Active reservations of the organization (hue-03 PAN-W8), one server page at
 * a time. The server already scopes the rows to the caller's role, so the web
 * only chooses the copy. Read-only: no cancel or edit control, just a link to
 * the caller's own reservations.
 */
const PanelReservationsTable = ({
  status,
  reservations,
  isAdmin,
  page,
  onPageChange,
  onRetry,
}: PanelReservationsTableProps) => {
  const headingId = useId();

  if (status === PANEL_STATUS.IDLE || status === PANEL_STATUS.FORBIDDEN) return null;

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="m-0 text-base font-semibold text-gray-900">
            {PANEL_COPY.reservationsTitle}
          </h2>
          <p className="m-0 mt-1 text-sm text-gray-500">
            {isAdmin ? PANEL_COPY.reservationsSubtitleAdmin : PANEL_COPY.reservationsSubtitleMember}
          </p>
        </div>
        <Link to="/arrendatario/mis-reservas" className={LINK_CLASS}>
          {PANEL_COPY.myReservationsLink}
        </Link>
      </div>

      {status === PANEL_STATUS.LOADING && (
        <p role="status" className="m-0 px-5 pb-5 text-sm text-gray-500">
          {PANEL_COPY.loading}
        </p>
      )}

      {status === PANEL_STATUS.ERROR && (
        <div className="flex items-center gap-4 px-5 pb-5">
          <p role="alert" className="m-0 text-sm text-red-600">
            {PANEL_COPY.reservationsError}
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

      {status === PANEL_STATUS.READY && reservations !== null && (
        <>
          {reservations.data.length === 0 ? (
            <p className="m-0 px-5 pb-6 text-center text-sm text-gray-400">
              {isAdmin ? PANEL_COPY.reservationsEmptyAdmin : PANEL_COPY.reservationsEmptyMember}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table aria-labelledby={headingId} className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {[
                      PANEL_COPY.warehouseColumn,
                      PANEL_COPY.memberColumn,
                      PANEL_COPY.periodColumn,
                      PANEL_COPY.amountColumn,
                      PANEL_COPY.paidWithWalletColumn,
                      PANEL_COPY.statusColumn,
                    ].map((label) => (
                      <th key={label} scope="col" className={HEADER_CELL_CLASS}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservations.data.map((row) => (
                    <ReservationRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PanelPagination page={page} lastPage={reservations.last_page} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
};

export default PanelReservationsTable;
