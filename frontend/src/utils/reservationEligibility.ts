/**
 * Single source of truth for reservation "vigencia" (validity window),
 * gestor cancel-eligibility, and PAGO (payment) status derivation.
 *
 * `start_date`/`end_date` are plain `YYYY-MM-DD` date strings with no time
 * or timezone component, and the backend compares them with `whereDate()`
 * against its own server-side `today()`. Comparing with `new Date()` would
 * pull in the viewer's local timezone and make the cancel button flicker in
 * and out of existence depending on where the gestor is physically located.
 * All comparisons here MUST stay lexicographic string comparisons on
 * `YYYY-MM-DD` values -- never `new Date(...)`.
 *
 * `isCancellableByGestor` mirrors the exact server rule at
 * backend/app/Services/ReservationService.php:162-166:
 *   status === 'confirmed' && rent_subtotal !== null && start_date > today()
 * This predicate MUST be defined exactly once and reused everywhere
 * (list, KPI tiles, detail view, cancel gate) -- never re-implemented.
 */

export type Vigencia = 'activa' | 'futura' | 'finalizada';

export type PagoEstado = 'PAGADO' | 'PENDIENTE' | 'REEMBOLSADO' | 'Sin cobro';

/** Returns today's date as a `YYYY-MM-DD` string in the local timezone. */
export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives vigencia purely from lexicographic `YYYY-MM-DD` string
 * comparison: "Finalizada" if the window already ended, "Activa" if today
 * falls within `[start_date, end_date]` inclusive, otherwise "Futura".
 */
export function deriveVigencia(startDate: string, endDate: string, today: string = todayDateOnly()): Vigencia {
  if (endDate < today) return 'finalizada';
  if (startDate <= today && today <= endDate) return 'activa';
  return 'futura';
}

/**
 * Mirrors `ReservationService::cancelByLandlord`'s eligibility check
 * exactly: confirmed, paid (rent_subtotal set), and strictly future
 * (start_date > today, not >=). A reservation starting today is "Activa"
 * and MUST NOT offer the cancel button.
 */
export function isCancellableByGestor(
  reservation: {
    status: string;
    start_date: string;
    rent_subtotal: string | number | null;
    can_be_cancelled?: boolean;
  },
  today: string = todayDateOnly()
): boolean {
  // The server decides. `landlordIndex()` computes `can_be_cancelled` from
  // Reservations::isCancellableByLandlord() -- the same method the cancel
  // guard calls -- so honouring it makes a 409 on an enabled button
  // impossible. The client cannot reach this answer alone: it would have to
  // guess the server's "today", and a viewer whose local date lags the
  // server's would enable a button the server rejects.
  if (typeof reservation.can_be_cancelled === 'boolean') {
    return reservation.can_be_cancelled;
  }

  // Fallback for payloads that do not carry the flag (the cancel response
  // returns a bare reservation). Same rule, best-effort, local dates.
  return (
    reservation.status === 'confirmed' &&
    reservation.rent_subtotal !== null &&
    reservation.start_date > today
  );
}

/**
 * Derives the PAGO label from backend-provided truth, never guessed
 * client-side. The backend's `landlordIndex()` exposes `payment_status`
 * ('paid' | 'pending') and `has_refund_obligation`. There are four real
 * situations, not the prototype's three (GestorPanel.jsx:47-51 only ever
 * defined PAGADO / PENDIENTE / REEMBOLSADO):
 *   - status=confirmed                          -> PAGADO
 *   - status=pending                             -> PENDIENTE
 *   - status=canceled, has_refund_obligation     -> REEMBOLSADO
 *   - status=canceled, !has_refund_obligation    -> "Sin cobro" (auto-blocked,
 *     never paid -- the prototype never modeled this case)
 */
export function derivePagoEstado(reservation: {
  status: string;
  payment_status: 'paid' | 'pending';
  has_refund_obligation: boolean;
}): PagoEstado {
  if (reservation.status === 'canceled') {
    return reservation.has_refund_obligation ? 'REEMBOLSADO' : 'Sin cobro';
  }

  return reservation.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE';
}
