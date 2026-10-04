/**
 * Reservation code shown on the checkout receipt. MUST stay byte-identical
 * to the backend's canonical twin `backend/app/Support/ReservationCode.php::
 * format()` — both take the real `reservation.id` and zero-pad it to 6
 * digits, never `Math.random()` (the prototype's anti-pattern at
 * `BookingFlow.jsx:475`, which produced an unlinked, non-deterministic
 * code).
 */
export function formatReservationCode(id: number): string {
  return `LEO-${String(id).padStart(6, "0")}`;
}
