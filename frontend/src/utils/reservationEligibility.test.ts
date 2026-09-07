import { describe, it, expect } from 'vitest';
import { deriveVigencia, isCancellableByGestor, derivePagoEstado } from './reservationEligibility';

describe('deriveVigencia', () => {
  const today = '2026-09-03';

  it('is "activa" when start_date === today (boundary)', () => {
    expect(deriveVigencia('2026-09-03', '2026-09-10', today)).toBe('activa');
  });

  it('is "activa" when end_date === today (boundary)', () => {
    expect(deriveVigencia('2026-08-20', '2026-09-03', today)).toBe('activa');
  });

  it('is "finalizada" when end_date < today', () => {
    expect(deriveVigencia('2026-08-01', '2026-09-02', today)).toBe('finalizada');
  });

  it('is "futura" when start_date > today', () => {
    expect(deriveVigencia('2026-09-04', '2026-09-10', today)).toBe('futura');
  });

  it('compares lexicographically as strings, never via new Date (no timezone drift)', () => {
    // '2026-09-10' > '2026-09-03' as strings, no Date object involved.
    expect(deriveVigencia('2026-09-10', '2026-09-20', today)).toBe('futura');
  });
});

describe('isCancellableByGestor', () => {
  const today = '2026-09-03';

  it('matches the exact server rule: confirmed + paid + strictly future', () => {
    expect(
      isCancellableByGestor(
        { status: 'confirmed', start_date: '2026-09-04', rent_subtotal: 3000 },
        today
      )
    ).toBe(true);
  });

  it('is false when start_date === today (server requires STRICTLY future)', () => {
    expect(
      isCancellableByGestor(
        { status: 'confirmed', start_date: '2026-09-03', rent_subtotal: 3000 },
        today
      )
    ).toBe(false);
  });

  it('is false when not confirmed', () => {
    expect(
      isCancellableByGestor(
        { status: 'pending', start_date: '2026-09-04', rent_subtotal: 3000 },
        today
      )
    ).toBe(false);
  });

  it('is false when rent_subtotal is null (unpaid)', () => {
    expect(
      isCancellableByGestor(
        { status: 'confirmed', start_date: '2026-09-04', rent_subtotal: null },
        today
      )
    ).toBe(false);
  });

  it('is false once the reservation already started', () => {
    expect(
      isCancellableByGestor(
        { status: 'confirmed', start_date: '2026-09-01', rent_subtotal: 3000 },
        today
      )
    ).toBe(false);
  });

  /**
   * The server's `can_be_cancelled` wins over any local derivation. This is
   * what closes the timezone window: a viewer whose local date lags the
   * server's would otherwise compute `true` for a reservation the server
   * rejects with 409, and show an enabled button that cannot work.
   */
  it('obeys the server flag when it disagrees with the local derivation', () => {
    // Local math says cancellable; the server says no. The server wins.
    expect(
      isCancellableByGestor(
        {
          status: 'confirmed',
          start_date: '2026-09-04',
          rent_subtotal: 3000,
          can_be_cancelled: false,
        },
        today
      )
    ).toBe(false);

    // Local math says not cancellable; the server says yes. The server wins.
    expect(
      isCancellableByGestor(
        {
          status: 'confirmed',
          start_date: '2026-09-03',
          rent_subtotal: 3000,
          can_be_cancelled: true,
        },
        today
      )
    ).toBe(true);
  });

  it('falls back to the local rule when the payload carries no server flag', () => {
    expect(
      isCancellableByGestor(
        { status: 'confirmed', start_date: '2026-09-04', rent_subtotal: 3000 },
        today
      )
    ).toBe(true);
  });
});

describe('derivePagoEstado', () => {
  it('confirmed -> PAGADO', () => {
    expect(
      derivePagoEstado({ status: 'confirmed', payment_status: 'paid', has_refund_obligation: false })
    ).toBe('PAGADO');
  });

  it('pending -> PENDIENTE', () => {
    expect(
      derivePagoEstado({ status: 'pending', payment_status: 'pending', has_refund_obligation: false })
    ).toBe('PENDIENTE');
  });

  it('canceled WITH a refund obligation -> REEMBOLSADO', () => {
    expect(
      derivePagoEstado({ status: 'canceled', payment_status: 'paid', has_refund_obligation: true })
    ).toBe('REEMBOLSADO');
  });

  it('canceled WITHOUT a refund obligation (auto-blocked, never paid) -> "Sin cobro"', () => {
    expect(
      derivePagoEstado({ status: 'canceled', payment_status: 'pending', has_refund_obligation: false })
    ).toBe('Sin cobro');
  });
});
