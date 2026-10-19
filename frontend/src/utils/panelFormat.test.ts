import { describe, it, expect } from 'vitest';

import { PANEL_HISTORY_KIND, type PanelHistoryEntry } from '../services/organizations';
import { composeHistorySentence, formatPanelDateTime, formatPeriodDay } from './panelFormat';

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

describe('formatPanelDateTime', () => {
  // Built from local fields so the expectation does not depend on the machine time zone.
  const localIso = (year: number, monthIndex: number, day: number, hour: number, minute: number) =>
    new Date(year, monthIndex, day, hour, minute).toISOString();

  it('formats the instant as day, short month, year and 24-hour time in the browser zone', () => {
    expect(formatPanelDateTime(localIso(2026, 5, 8, 9, 12))).toBe('08 jun 2026 · 09:12');
    expect(formatPanelDateTime(localIso(2026, 0, 3, 18, 5))).toBe('03 ene 2026 · 18:05');
  });

  it('uses 24-hour time around midnight and noon', () => {
    expect(formatPanelDateTime(localIso(2026, 10, 1, 0, 0))).toBe('01 nov 2026 · 00:00');
    expect(formatPanelDateTime(localIso(2026, 10, 1, 12, 30))).toBe('01 nov 2026 · 12:30');
  });

  it('strips trailing periods from abbreviated month names', () => {
    expect(formatPanelDateTime(localIso(2026, 3, 20, 7, 45))).not.toContain('.');
    expect(formatPanelDateTime(localIso(2026, 3, 20, 7, 45))).toBe('20 abr 2026 · 07:45');
  });

  it('returns an empty string for an unparseable value', () => {
    expect(formatPanelDateTime('not-a-date')).toBe('');
  });
});

describe('composeHistorySentence', () => {
  const entry = (overrides: Partial<PanelHistoryEntry> = {}): PanelHistoryEntry => ({
    id: 'reservation_created:1',
    kind: PANEL_HISTORY_KIND.RESERVATION_CREATED,
    occurred_at: '2026-06-08T09:12:00Z',
    actor_name: 'Ana Pérez',
    target_label: 'Bodega Norte',
    amount: null,
    ...overrides,
  });

  const text = (segments: { text: string }[]) => segments.map((segment) => segment.text).join('');

  it('WS45: a created reservation reads actor reservó bodega, with actor and warehouse emphasised', () => {
    const segments = composeHistorySentence(entry());

    expect(text(segments)).toBe('Ana Pérez reservó Bodega Norte');
    expect(segments.filter((segment) => segment.strong).map((segment) => segment.text)).toEqual([
      'Ana Pérez',
      'Bodega Norte',
    ]);
  });

  it('WS46: a cancelled reservation names the actor and the warehouse', () => {
    const sentence = text(composeHistorySentence(entry({ kind: PANEL_HISTORY_KIND.RESERVATION_CANCELLED })));

    expect(sentence).toBe('Ana Pérez canceló la reserva de Bodega Norte');
  });

  it('WS47: a top-up shows the amount as USD and no warehouse', () => {
    const sentence = text(
      composeHistorySentence(entry({ kind: PANEL_HISTORY_KIND.WALLET_TOPUP, target_label: null, amount: '150.00' })),
    );

    expect(sentence).toBe('Ana Pérez recargó la billetera con $150.00');
  });

  it('WS48: a refund leads with the amount and names the warehouse, not the actor', () => {
    const sentence = text(
      composeHistorySentence(entry({ kind: PANEL_HISTORY_KIND.WALLET_REFUND, actor_name: null, amount: '90.00' })),
    );

    expect(sentence).toBe('Se reembolsaron $90.00 a la billetera por la reserva de Bodega Norte');
  });

  it('WS49: a member joining needs only the actor', () => {
    const sentence = text(
      composeHistorySentence(entry({ kind: PANEL_HISTORY_KIND.MEMBER_JOINED, target_label: null })),
    );

    expect(sentence).toBe('Ana Pérez se unió a la organización');
  });

  it('WS51: a missing actor or warehouse uses the approved fallbacks', () => {
    expect(text(composeHistorySentence(entry({ actor_name: null, target_label: null })))).toBe(
      'Un usuario que ya no está reservó una bodega que ya no está disponible',
    );
  });

  it('a money row without an amount shows a dash instead of NaN', () => {
    const sentence = text(
      composeHistorySentence(entry({ kind: PANEL_HISTORY_KIND.WALLET_TOPUP, target_label: null, amount: null })),
    );

    expect(sentence).toBe('Ana Pérez recargó la billetera con —');
  });

  it('WS50: an unknown future kind gets a neutral generic line and does not throw', () => {
    const segments = composeHistorySentence(entry({ kind: 'reservation_extended' }));

    expect(segments).toEqual([{ text: 'Actividad registrada en la organización', strong: false }]);
  });

  it('does not re-interpret placeholders that appear inside a name', () => {
    const sentence = text(composeHistorySentence(entry({ actor_name: '{monto} {bodega}' })));

    expect(sentence).toBe('{monto} {bodega} reservó Bodega Norte');
  });
});
