/**
 * sdd/tenant-reservations-screen, design decision #5: derives which of the
 * three tenant tabs (Activas / Finalizadas / Canceladas) a reservation
 * belongs to. No backend field maps status+dates to this directly, so this
 * is a frontend-only pure function -- safe because tab membership is not
 * money-critical, unlike `can_be_cancelled` (which MUST stay
 * server-authoritative, never derived here).
 *
 * `pending` (never paid) and a not-yet-ended `confirmed` reservation both
 * flatten into "activa", matching the prototype's own flattening of
 * "current" and "future" into a single Activas tab (decision #349).
 */

export type TenantTab = 'activa' | 'finalizada' | 'cancelada';

/** Returns today's date as a `YYYY-MM-DD` string in the local timezone. */
function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deriveTenantTab(
  reservation: { status: string; end_date: string },
  today: string = todayDateOnly()
): TenantTab {
  if (reservation.status === 'canceled') return 'cancelada';
  if (reservation.status === 'confirmed' && reservation.end_date < today) return 'finalizada';
  return 'activa';
}
