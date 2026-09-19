import { describe, it, expect } from 'vitest';

import { deriveTenantTab } from './reservationVigencia';

/**
 * sdd/tenant-reservations-screen, design decision #5: truth table for the
 * three tenant tabs. `pending` (never paid) and not-yet-ended `confirmed`
 * both flatten into "activa" -- the prototype's own flattening of
 * "current" and "future" into a single Activas tab (decision #349).
 */
describe('deriveTenantTab', () => {
  const today = '2026-06-18';

  it('a canceled reservation is always cancelada, regardless of dates', () => {
    expect(
      deriveTenantTab({ status: 'canceled', end_date: '2030-01-01' }, today)
    ).toBe('cancelada');
    expect(
      deriveTenantTab({ status: 'canceled', end_date: '2020-01-01' }, today)
    ).toBe('cancelada');
  });

  it('a confirmed reservation whose end_date already passed is finalizada', () => {
    expect(
      deriveTenantTab({ status: 'confirmed', end_date: '2026-06-17' }, today)
    ).toBe('finalizada');
  });

  it('a confirmed reservation whose end_date is today or later is activa', () => {
    expect(
      deriveTenantTab({ status: 'confirmed', end_date: '2026-06-18' }, today)
    ).toBe('activa');
    expect(
      deriveTenantTab({ status: 'confirmed', end_date: '2026-07-01' }, today)
    ).toBe('activa');
  });

  it('a pending reservation is always activa, even if end_date is in the past', () => {
    expect(
      deriveTenantTab({ status: 'pending', end_date: '2026-07-01' }, today)
    ).toBe('activa');
    expect(
      deriveTenantTab({ status: 'pending', end_date: '2020-01-01' }, today)
    ).toBe('activa');
  });
});
