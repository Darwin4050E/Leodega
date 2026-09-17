/**
 * Date-only ISO helpers moved from `LeodegaUI.tsx:23-32` so both the
 * reservation modal and the read-only `AvailabilityCalendar` share the same
 * date math instead of duplicating it.
 */
export function toDateOnlyISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateBetween(target: string, start: string, end: string): boolean {
  return target >= start && target <= end;
}

/**
 * Trivial date computation (not a pricing computation, so not forbidden by
 * REQ-PAY-2 / REQ-REC-4): months between two date-only ISO strings, rounded
 * from total days / 30. Shared by `BookingCheckout` and `BookingReceipt`'s
 * "Duración" summary line — previously duplicated verbatim in both files.
 */
export function monthsBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const totalDays = (end.getTime() - start.getTime()) / 86_400_000;
  return Math.max(1, Math.round(totalDays / 30));
}

/**
 * Formats a date-only ISO string (e.g. "2026-09-15") as "<month> <year>" in
 * Spanish, e.g. "septiembre 2026", for the "Miembro desde" line on the
 * storeroom detail's "Tu gestor" card. Returns null for a null/absent/
 * unparseable value so the caller can skip rendering the line entirely
 * instead of showing "Miembro desde Invalid Date".
 */
export function formatMemberSince(dateOnlyISO: string | null | undefined): string | null {
  if (!dateOnlyISO) return null;
  // Parsed as UTC (not via `new Date(dateOnlyISO)`, which JS interprets as
  // UTC midnight but Intl.DateTimeFormat then renders in the local
  // timezone — shifting to the previous month for any negative UTC offset).
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnlyISO);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(parsed.getTime())) return null;
  // Built as "<month> <year>" (no "de") instead of formatting both fields
  // together: es-locale Intl output for {month, year} is "septiembre de
  // 2026", but the product copy wants "septiembre 2026".
  const monthName = new Intl.DateTimeFormat("es", { month: "long", timeZone: "UTC" }).format(parsed);
  return `${monthName} ${year}`;
}
