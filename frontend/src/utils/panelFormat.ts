import { isPanelHistoryKind, PANEL_HISTORY_KIND, type PanelHistoryEntry } from "../services/organizations";
import { formatUSD } from "./money";
import { PANEL_COPY } from "./panelCopy";

const dayFormatter = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", timeZone: "UTC" });

/**
 * "01 nov" from a `Y-m-d` string. A date-only value is read as UTC and
 * formatted as UTC, so a negative browser offset never moves it to the day
 * before. Returns "" when the value cannot be parsed.
 */
export function formatPeriodDay(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
  if (match === null) return "";
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(parsed.getTime())) return "";
  // The separator between day and month depends on the ICU build ("01-ene"), so the parts are joined here.
  const part = (type: "day" | "month") =>
    dayFormatter.formatToParts(parsed).find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replaceAll(".", "")}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "08 jun 2026 · 09:12" from an ISO instant, in the browser time zone and
 * 24-hour time. Returns "" when the value cannot be parsed.
 */
export function formatPanelDateTime(instant: string): string {
  const parsed = new Date(instant);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = dateTimeFormatter.formatToParts(parsed);
  const part = (type: "day" | "month" | "year" | "hour" | "minute") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replaceAll(".", "")} ${part("year")} · ${part("hour")}:${part("minute")}`;
}

export interface HistorySegment {
  text: string;
  strong: boolean;
}

const PLACEHOLDER = /(\{\w+\})/;

// Splitting before substituting means a name that happens to contain "{monto}" is never re-interpreted.
function fillTemplate(template: string, values: Record<string, HistorySegment>): HistorySegment[] {
  return template
    .split(PLACEHOLDER)
    .filter((piece) => piece !== "")
    .map((piece) => values[piece.slice(1, -1)] ?? { text: piece, strong: false });
}

function templateFor(kind: string): string | null {
  if (!isPanelHistoryKind(kind)) return null;
  switch (kind) {
    case PANEL_HISTORY_KIND.RESERVATION_CREATED:
      return PANEL_COPY.historyReservationCreated;
    case PANEL_HISTORY_KIND.RESERVATION_CANCELLED:
      return PANEL_COPY.historyReservationCancelled;
    case PANEL_HISTORY_KIND.WALLET_TOPUP:
      return PANEL_COPY.historyWalletTopup;
    case PANEL_HISTORY_KIND.WALLET_REFUND:
      return PANEL_COPY.historyWalletRefund;
    case PANEL_HISTORY_KIND.MEMBER_JOINED:
      return PANEL_COPY.historyMemberJoined;
  }
}

/**
 * Builds the sentence of one history row from its fields; the server sends no
 * text. The actor and the warehouse come back emphasised. A kind this build
 * does not know gets a neutral line instead of an error (WS50).
 */
export function composeHistorySentence(entry: PanelHistoryEntry): HistorySegment[] {
  const template = templateFor(entry.kind);
  if (template === null) return [{ text: PANEL_COPY.historyUnknownKind, strong: false }];

  return fillTemplate(template, {
    actor: { text: entry.actor_name ?? PANEL_COPY.historyUnknownActor, strong: true },
    bodega: { text: entry.target_label ?? PANEL_COPY.historyUnknownWarehouse, strong: true },
    monto: {
      text: entry.amount === null ? PANEL_COPY.hiddenAmount : formatUSD(entry.amount, { fixed: true }),
      strong: false,
    },
  });
}
