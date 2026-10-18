import { Calendar, Clock, DollarSign, User, X, type LucideIcon } from "lucide-react";
import { Fragment, useId } from "react";

import { PANEL_STATUS, type PanelStatus } from "../hooks/useOrganizationPanel";
import {
  isPanelHistoryKind,
  PANEL_HISTORY_KIND,
  type PanelHistoryEntry,
  type PanelHistoryKind,
  type PaginatedPanelHistory,
} from "../services/organizations";
import { PANEL_COPY } from "../utils/panelCopy";
import { composeHistorySentence, formatPanelDateTime } from "../utils/panelFormat";
import PanelPagination from "./PanelPagination";

interface PanelHistoryFeedProps {
  status: PanelStatus;
  history: PaginatedPanelHistory | null;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

interface KindStyle {
  icon: LucideIcon;
  tone: string;
}

const TONE = {
  brand: "bg-leodega-50 text-leodega-700",
  ok: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-600",
  neutral: "bg-gray-100 text-gray-500",
} as const;

const KIND_STYLE: Record<PanelHistoryKind, KindStyle> = {
  [PANEL_HISTORY_KIND.RESERVATION_CREATED]: { icon: Calendar, tone: TONE.brand },
  [PANEL_HISTORY_KIND.RESERVATION_CANCELLED]: { icon: X, tone: TONE.error },
  [PANEL_HISTORY_KIND.WALLET_TOPUP]: { icon: DollarSign, tone: TONE.ok },
  [PANEL_HISTORY_KIND.WALLET_REFUND]: { icon: DollarSign, tone: TONE.ok },
  [PANEL_HISTORY_KIND.MEMBER_JOINED]: { icon: User, tone: TONE.ok },
};

const UNKNOWN_KIND_STYLE: KindStyle = { icon: Clock, tone: TONE.neutral };

const HistoryRow = ({ entry }: { entry: PanelHistoryEntry }) => {
  const { icon: Icon, tone } = isPanelHistoryKind(entry.kind) ? KIND_STYLE[entry.kind] : UNKNOWN_KIND_STYLE;

  return (
    <li className="flex gap-3 border-t border-gray-100 py-3 first:border-t-0">
      <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-sm leading-snug text-gray-700">
          {composeHistorySentence(entry).map((segment, index) => (
            <Fragment key={index}>
              {segment.strong ? <strong className="font-semibold text-gray-900">{segment.text}</strong> : segment.text}
            </Fragment>
          ))}
        </p>
        <time dateTime={entry.occurred_at} className="mt-0.5 block text-xs text-gray-400">
          {formatPanelDateTime(entry.occurred_at)}
        </time>
      </div>
    </li>
  );
};

/**
 * Admin-only activity feed (hue-03 PAN-W9), one server page at a time. The web
 * composes each sentence from the row fields. A refusal (403) or a section
 * that was never requested renders nothing, so a member never sees a trace of
 * it. Read-only: the only controls are retry and pagination.
 */
const PanelHistoryFeed = ({ status, history, page, onPageChange, onRetry }: PanelHistoryFeedProps) => {
  const headingId = useId();

  if (status === PANEL_STATUS.IDLE || status === PANEL_STATUS.FORBIDDEN) return null;

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-gray-200 bg-white">
      <div className="px-5 pt-5 pb-3">
        <h2 id={headingId} className="m-0 text-base font-semibold text-gray-900">
          {PANEL_COPY.historyTitle}
        </h2>
        <p className="m-0 mt-1 text-sm text-gray-500">{PANEL_COPY.historySubtitle}</p>
      </div>

      {status === PANEL_STATUS.LOADING && (
        <p role="status" className="m-0 px-5 pb-5 text-sm text-gray-500">
          {PANEL_COPY.loading}
        </p>
      )}

      {status === PANEL_STATUS.ERROR && (
        <div className="flex items-center gap-4 px-5 pb-5">
          <p role="alert" className="m-0 text-sm text-red-600">
            {PANEL_COPY.historyError}
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

      {status === PANEL_STATUS.READY && history !== null && (
        <>
          {history.data.length === 0 ? (
            <p className="m-0 px-5 pb-6 text-center text-sm text-gray-400">{PANEL_COPY.historyEmpty}</p>
          ) : (
            <ul className="m-0 list-none px-5 pb-2">
              {history.data.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
          <PanelPagination page={page} lastPage={history.last_page} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
};

export default PanelHistoryFeed;
