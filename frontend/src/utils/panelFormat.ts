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
