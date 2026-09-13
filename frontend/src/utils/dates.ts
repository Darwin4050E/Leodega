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
