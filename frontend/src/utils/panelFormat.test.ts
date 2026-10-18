import { describe, it, expect } from 'vitest';

import { formatPeriodDay } from './panelFormat';

describe('formatPeriodDay', () => {
  it('formats a Y-m-d date as day and short Spanish month without a trailing period', () => {
    expect(formatPeriodDay('2026-11-01')).toBe('01 nov');
    expect(formatPeriodDay('2026-10-30')).toBe('30 oct');
  });

  it('does not shift the day with the browser time zone', () => {
    expect(formatPeriodDay('2026-01-01')).toBe('01 ene');
    expect(formatPeriodDay('2026-12-31')).toBe('31 dic');
  });

  it('returns an empty string for an unparseable value', () => {
    expect(formatPeriodDay('not-a-date')).toBe('');
  });
});
