import { describe, it, expect } from 'vitest';
import { INVITATION_COPY } from './invitationCopy';
import { PANEL_COPY } from './panelCopy';

describe('PANEL_COPY (core chunk, PC-1..PC-18)', () => {
  it.each([
    ['title', 'Panel de la empresa'],
    ['ribbonLink', 'Ver panel'],
    ['adminBadge', 'Administrador'],
    ['memberBadge', 'Miembro'],
    ['memberNoticeTitle', 'Vista de miembro'],
    [
      'memberNoticeBody',
      'Eres miembro de esta organización. Puedes ver los miembros y las reservas; solo el administrador puede ver el historial, invitar miembros, recargar saldo y fijar límites.',
    ],
    ['noOrganization', 'Selecciona una organización para ver el panel.'],
    ['loading', 'Cargando…'],
    ['membersLabel', 'Miembros activos'],
    ['membersSub', 'Incluido el administrador'],
    ['reservationsLabel', 'Reservas vigentes'],
    ['reservationsSubAdmin', 'A nombre de la organización'],
    ['reservationsSubMember', 'Hechas por ti'],
    ['pendingLabel', 'Invitaciones pendientes'],
    ['pendingSub', 'Esperando respuesta'],
    ['summaryError', 'No pudimos cargar el resumen'],
  ] as const)('PC %s resolves to the approved text', (key, expected) => {
    expect(PANEL_COPY[key]).toBe(expected);
  });

  it('PC-3 composes the subtitle from the short organization name', () => {
    expect(PANEL_COPY.subtitle('Acme')).toBe('Miembros, reservas y actividad de Acme');
  });

  it('PC-4 composes the RUC line', () => {
    expect(PANEL_COPY.ruc('1790012345001')).toBe('RUC 1790012345001');
  });

  it('reuses the existing retry label instead of defining a new one', () => {
    expect(PANEL_COPY.retry).toBe(INVITATION_COPY.inboxRetry);
    expect(PANEL_COPY.retry).toBe('Reintentar');
  });
});

describe('PANEL_COPY (wallet and members chunk, PC-19..PC-40)', () => {
  it.each([
    ['walletTitle', 'Billetera de la empresa'],
    [
      'walletSubtitle',
      'Las reservas de la organización se pagan con este saldo, no con la tarjeta de cada miembro',
    ],
    ['walletBalanceLabel', 'Saldo disponible'],
    ['walletCurrency', 'USD'],
    ['walletEmptyBadge', 'Sin saldo'],
    ['walletLink', 'Ver billetera'],
    ['walletError', 'No pudimos cargar el saldo'],
    ['membersTitle', 'Miembros'],
    ['membersSubtitleAdmin', 'Límite de gasto mensual por miembro · se reinicia el día 1 de cada mes'],
    ['membersSubtitleMember', 'Solo ves tu propio consumo mensual'],
    ['memberColumn', 'Miembro'],
    ['limitColumn', 'Límite mensual'],
    ['spentColumn', 'Consumido este mes'],
    ['noLimit', 'Sin límite'],
    ['selfMarker', '· tú'],
    ['unlimitedSpent', '· sin tope'],
    ['inviteLink', 'Invitar'],
    ['manageLimitsLink', 'Gestionar límites'],
    ['membersError', 'No pudimos cargar los miembros'],
  ] as const)('PC %s resolves to the approved text', (key, expected) => {
    expect(PANEL_COPY[key]).toBe(expected);
  });

  it('PC-34 composes the monthly limit', () => {
    expect(PANEL_COPY.limitPerMonth('$100.00')).toBe('$100.00 /mes');
  });

  it('PC-36 composes the join date', () => {
    expect(PANEL_COPY.since('08 jun 2026')).toBe('desde 08 jun 2026');
  });

  it('composes the consumed-of-limit line', () => {
    expect(PANEL_COPY.spentOfLimit('$40.00', '$100.00')).toBe('$40.00 de $100.00');
  });
});

describe('PANEL_COPY (reservations chunk, PC-41..PC-51 and PC-62)', () => {
  it.each([
    ['reservationsTitle', 'Reservas a nombre de la empresa'],
    ['reservationsSubtitleAdmin', 'Visibles para todos los miembros · se pagan con el saldo de la billetera'],
    ['reservationsSubtitleMember', 'Solo ves las reservas que hiciste · se pagan con el saldo de la billetera'],
    ['warehouseColumn', 'Bodega'],
    ['periodColumn', 'Período'],
    ['amountColumn', 'Monto'],
    ['paidWithWalletColumn', 'Pagado con saldo'],
    ['statusColumn', 'Estado'],
    ['statusPending', 'Pendiente'],
    ['statusActive', 'Activa'],
    ['paidByCard', 'Tarjeta'],
    ['hiddenAmount', '—'],
    [
      'reservationsEmptyAdmin',
      'Aún no hay reservas a nombre de la empresa. Reserva en contexto de empresa desde el catálogo.',
    ],
    ['reservationsEmptyMember', 'Aún no tienes reservas a nombre de la empresa.'],
    ['myReservationsLink', 'Ver mis reservas'],
    ['reservationsError', 'No pudimos cargar las reservas'],
  ] as const)('PC %s resolves to the approved text', (key, expected) => {
    expect(PANEL_COPY[key]).toBe(expected);
  });

  it('PC-45 composes the reservation period', () => {
    expect(PANEL_COPY.period('01 nov', '30 nov')).toBe('01 nov — 30 nov');
  });
});
