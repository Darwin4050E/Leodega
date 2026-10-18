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
