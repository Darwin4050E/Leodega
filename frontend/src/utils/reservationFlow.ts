import type { ReservedRange } from "../services/reservations";

/** ERS HUC-03 S2: the single copy shown on any date overlap (client check or server 409). */
export const RESERVATION_OVERLAP_MESSAGE =
  "Las fechas seleccionadas no están disponibles. Elige otro período";

/** ERS HUC-03 S3: shown on /login when a visitor was sent there by Reservar. */
export const LOGIN_REQUIRED_MESSAGE = "Debes iniciar sesión para hacer una reserva";

// eslint-disable-next-line no-control-regex
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

/**
 * Validates a post-login return target taken from router state. Only
 * internal paths are accepted (starts with "/", not "//", no scheme, no
 * backslash, no control characters); anything else yields null so the caller
 * falls back to its role-based redirect. This is the open-redirect guard.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (CONTROL_OR_BACKSLASH.test(value)) return null;
  return value;
}

const DEFAULT_OCCUPIED_HINT_LIMIT = 3;

/**
 * Picks the occupied periods worth listing in the booking modal: those that
 * have not ended yet, soonest first, capped at `limit`. The native date inputs
 * cannot be styled, so this feeds a textual "Períodos ocupados" hint instead.
 */
export function upcomingOccupiedRanges(
  ranges: ReservedRange[],
  todayISO: string,
  limit = DEFAULT_OCCUPIED_HINT_LIMIT
): ReservedRange[] {
  return ranges
    .filter((r) => r.end_date >= todayISO)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, limit);
}
