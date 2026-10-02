import { describe, it, expect } from 'vitest';
import {
  RESERVATION_OVERLAP_MESSAGE,
  LOGIN_REQUIRED_MESSAGE,
  safeReturnPath,
  upcomingOccupiedRanges,
} from './reservationFlow';

describe('reservationFlow messages', () => {
  it('exposes the exact ERS copy for the overlap and login-required messages', () => {
    expect(RESERVATION_OVERLAP_MESSAGE).toBe(
      'Las fechas seleccionadas no están disponibles. Elige otro período'
    );
    expect(LOGIN_REQUIRED_MESSAGE).toBe('Debes iniciar sesión para hacer una reserva');
  });
});

describe('safeReturnPath', () => {
  it.each([
    ['/leodega/7', '/leodega/7'],
    ['/storage', '/storage'],
    ['/leodega/7?tab=1#cal', '/leodega/7?tab=1#cal'],
  ])('accepts the internal path %s', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute https', 'https://x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['slash-backslash', '/\\x'],
    ['backslash inside', '/a\\b'],
    ['control character', '/leodega/7\n'],
    ['tab character', '/leo\tdega'],
    ['relative without slash', 'leodega/7'],
    ['empty string', ''],
  ])('rejects %s', (_label, input) => {
    expect(safeReturnPath(input)).toBeNull();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 7],
    ['object', { path: '/leodega/7' }],
  ])('rejects a non-string value (%s)', (_label, input) => {
    expect(safeReturnPath(input)).toBeNull();
  });
});

describe('upcomingOccupiedRanges', () => {
  const range = (start_date: string, end_date: string) => ({ start_date, end_date });

  it('drops ranges that ended before today and keeps one ending today', () => {
    const result = upcomingOccupiedRanges(
      [range('2030-01-01', '2030-01-09'), range('2030-01-05', '2030-01-10'), range('2030-02-01', '2030-02-03')],
      '2030-01-10'
    );

    expect(result).toEqual([range('2030-01-05', '2030-01-10'), range('2030-02-01', '2030-02-03')]);
  });

  it('sorts by start date and returns at most 3 by default', () => {
    const result = upcomingOccupiedRanges(
      [
        range('2030-05-01', '2030-05-02'),
        range('2030-02-01', '2030-02-02'),
        range('2030-04-01', '2030-04-02'),
        range('2030-03-01', '2030-03-02'),
      ],
      '2030-01-01'
    );

    expect(result.map((r) => r.start_date)).toEqual(['2030-02-01', '2030-03-01', '2030-04-01']);
  });

  it('honors an explicit limit and does not mutate its input', () => {
    const input = [range('2030-03-01', '2030-03-02'), range('2030-02-01', '2030-02-02')];

    const result = upcomingOccupiedRanges(input, '2030-01-01', 1);

    expect(result).toEqual([range('2030-02-01', '2030-02-02')]);
    expect(input[0].start_date).toBe('2030-03-01');
  });

  it('returns an empty list when every range is in the past', () => {
    expect(upcomingOccupiedRanges([range('2029-01-01', '2029-01-05')], '2030-01-01')).toEqual([]);
  });
});
