import { describe, it, expect } from 'vitest';
import { InvitationStatus } from '../services/organizations';
import {
  INVITATION_COPY,
  INVITATION_FAILURE,
  formatInvitationDate,
  resolveInvitationFailure,
} from './invitationCopy';

function apiError(status: number, data: unknown) {
  return { response: { status, data } };
}

describe('INVITATION_COPY', () => {
  it.each([
    ['title', 'Invitar miembros'],
    ['emailLabel', 'Buscar usuario por correo'],
    ['emailPlaceholder', 'nombre@correo.com'],
    ['helper', 'Solo clientes pueden unirse; los gestores de bodega no.'],
    ['submit', 'Enviar invitación'],
    ['submitting', 'Enviando...'],
    ['blankEmail', 'Escribe el correo del cliente que quieres invitar.'],
    ['invalidEmail', 'Ingresa un correo válido.'],
    ['clientNoticeTitle', 'Ingresa un correo'],
    ['refusalTitle', 'No puedes invitar a este correo'],
    ['successTitle', 'Invitación enviada'],
    ['sendError', 'No se pudo enviar la invitación. Intenta nuevamente.'],
    ['listHeading', 'Invitaciones'],
    ['listLoading', 'Cargando invitaciones…'],
    ['listEmpty', 'Aún no has enviado invitaciones.'],
    ['listError', 'No pudimos cargar las invitaciones'],
    ['revoke', 'Revocar'],
    ['revoking', 'Revocando...'],
    ['revokedToast', 'Invitación revocada'],
    ['revokeError', 'No se pudo revocar la invitación. Intenta nuevamente.'],
    ['noOrganization', 'Selecciona una organización para invitar miembros.'],
    ['memberViewTitle', 'Vista de miembro'],
    ['memberViewBody', 'Eres miembro de esta organización. Solo el administrador puede invitar o quitar miembros.'],
    ['entryButton', 'Invitar'],
    ['previousPage', 'Anterior'],
    ['nextPage', 'Siguiente'],
  ] as const)('WS54: %s resolves to the approved string', (key, expected) => {
    expect(INVITATION_COPY[key]).toBe(expected);
  });

  it('WS11: the subtitle names the active organization', () => {
    expect(INVITATION_COPY.subtitle('Acme S.A.')).toBe(
      'Suma clientes a Acme S.A. buscándolos por correo. Tú decides quién puede reservar en nombre de la empresa.',
    );
  });

  it('WS16: the success notice body and the toast carry the invited email', () => {
    expect(INVITATION_COPY.successBody('ana@x.com')).toBe(
      'Le avisamos a ana@x.com en su cuenta de cliente. Aparecerá en su bandeja de invitaciones.',
    );
    expect(INVITATION_COPY.successToast('ana@x.com')).toBe('Invitación enviada a ana@x.com');
  });

  it('WS26 WS32: the counter is verbatim, also for exactly one', () => {
    expect(INVITATION_COPY.counter(2, 25)).toBe('2 pendientes · 25 en total');
    expect(INVITATION_COPY.counter(1, 1)).toBe('1 pendientes · 1 en total');
    expect(INVITATION_COPY.counter(0, 0)).toBe('0 pendientes · 0 en total');
  });

  it('WS29 WS30 WS31: the row meta fragments', () => {
    expect(INVITATION_COPY.sentOn('08 jun 2026')).toBe('enviada 08 jun 2026');
    expect(INVITATION_COPY.expiresOn('15 jun 2026')).toBe('vence 15 jun 2026');
    expect(INVITATION_COPY.invitedBy('María López')).toBe('invitada por María López');
  });

  it('WS43: the page indicator', () => {
    expect(INVITATION_COPY.pageOf(1, 3)).toBe('Página 1 de 3');
  });

  it('WS28: one label per effective status', () => {
    expect(INVITATION_COPY.statusLabel).toEqual({
      [InvitationStatus.PENDING]: 'Pendiente',
      [InvitationStatus.ACCEPTED]: 'Aceptada',
      [InvitationStatus.REJECTED]: 'Rechazada',
      [InvitationStatus.EXPIRED]: 'Expirada',
      [InvitationStatus.CANCELLED]: 'Cancelada',
    });
  });
});

describe('formatInvitationDate', () => {
  it('WS29: renders a two-digit day, abbreviated Spanish month and year', () => {
    expect(formatInvitationDate('2026-06-08T12:00:00Z')).toBe('08 jun 2026');
    expect(formatInvitationDate('2026-01-05T12:00:00Z')).toBe('05 ene 2026');
  });

  it('never leaves a period in the abbreviated month, whatever the ICU build adds', () => {
    for (let month = 0; month < 12; month += 1) {
      const iso = new Date(Date.UTC(2026, month, 15, 12)).toISOString();
      expect(formatInvitationDate(iso)).toMatch(/^15 [a-zñ]+ 2026$/);
    }
  });

  it('returns an empty string for an unparseable value instead of "Invalid Date"', () => {
    expect(formatInvitationDate('not-a-date')).toBe('');
  });
});

describe('resolveInvitationFailure', () => {
  const fallback = 'fallback copy';

  it('WS22: a 422 shows errors.email[0] verbatim', () => {
    const error = apiError(422, {
      message: 'Este usuario ya es miembro de tu organización',
      errors: { email: ['Este usuario ya es miembro de tu organización'] },
    });

    expect(resolveInvitationFailure(error, fallback)).toEqual({
      kind: INVITATION_FAILURE.MESSAGE,
      message: 'Este usuario ya es miembro de tu organización',
    });
  });

  it('WS18: a 422 without errors.email shows errors.organization[0]', () => {
    const error = apiError(422, {
      message: 'La organización seleccionada no está activa.',
      errors: { organization: ['La organización seleccionada no está activa.'] },
    });

    expect(resolveInvitationFailure(error, fallback)).toEqual({
      kind: INVITATION_FAILURE.MESSAGE,
      message: 'La organización seleccionada no está activa.',
    });
  });

  it('prefers errors.email over errors.organization when both exist', () => {
    const error = apiError(422, { message: 'm', errors: { organization: ['org'], email: ['mail'] } });

    expect(resolveInvitationFailure(error, fallback)).toEqual({ kind: INVITATION_FAILURE.MESSAGE, message: 'mail' });
  });

  it('WS19: a 429 shows the server message', () => {
    const error = apiError(429, { message: 'Enviaste demasiadas invitaciones. Intenta de nuevo en un minuto.' });

    expect(resolveInvitationFailure(error, fallback)).toEqual({
      kind: INVITATION_FAILURE.MESSAGE,
      message: 'Enviaste demasiadas invitaciones. Intenta de nuevo en un minuto.',
    });
  });

  it('WS37 WS38: a revoke 409 and 404 show the server message', () => {
    expect(resolveInvitationFailure(apiError(409, { message: 'Esta invitación ya no está disponible' }), fallback))
      .toEqual({ kind: INVITATION_FAILURE.MESSAGE, message: 'Esta invitación ya no está disponible' });
    expect(resolveInvitationFailure(apiError(404, { message: 'Invitación no encontrada' }), fallback))
      .toEqual({ kind: INVITATION_FAILURE.MESSAGE, message: 'Invitación no encontrada' });
  });

  it('WS5 WS6 WS39: a 403 is the member-view signal, whatever its message', () => {
    expect(resolveInvitationFailure(apiError(403, { message: 'No autorizado' }), fallback))
      .toEqual({ kind: INVITATION_FAILURE.FORBIDDEN });
  });

  it('WS20 WS40: a 5xx, a network error and an unknown shape use the caller fallback', () => {
    const expected = { kind: INVITATION_FAILURE.MESSAGE, message: fallback };

    expect(resolveInvitationFailure(apiError(500, { message: 'Server Error' }), fallback)).toEqual(expected);
    expect(resolveInvitationFailure(new Error('Network Error'), fallback)).toEqual(expected);
    expect(resolveInvitationFailure(undefined, fallback)).toEqual(expected);
  });

  it('falls back when a handled status carries no usable text', () => {
    const expected = { kind: INVITATION_FAILURE.MESSAGE, message: fallback };

    expect(resolveInvitationFailure(apiError(422, { errors: { email: [] } }), fallback)).toEqual(expected);
    expect(resolveInvitationFailure(apiError(429, {}), fallback)).toEqual(expected);
  });
});
