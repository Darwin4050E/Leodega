import { describe, it, expect } from 'vitest';
import { InvitationStatus } from '../services/organizations';
import {
  INVITATION_COPY,
  INVITATION_FAILURE,
  RESPOND_ACTION,
  formatInvitationDate,
  formatInvitationExpiry,
  resolveInvitationFailure,
  resolveRespondFailure,
} from './invitationCopy';
import { organizationInitials, organizationShortName } from './organization';

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

describe('INVITATION_COPY invitee inbox (IC-48..IC-79)', () => {
  it.each([
    ['inboxTitle', 'Invitaciones'],
    ['inboxSubtitle', 'Organizaciones que te invitaron a operar en su nombre.'],
    ['inboxEyebrow', 'Te invitaron a unirte'],
    ['inboxRoleLabel', 'Rol'],
    ['inboxRoleValue', 'Miembro'],
    ['inboxPermissionLabel', 'Al aceptar podrás'],
    ['inboxPermissionValue', 'Reservar a nombre de la empresa'],
    ['inboxExpiresLabel', 'Vence'],
    ['inboxExpiresInOneDay', 'en 1 día'],
    ['acceptInvitation', 'Aceptar invitación'],
    ['rejectInvitation', 'Rechazar'],
    ['expiredNoticeTitle', 'Esta invitación ya no está disponible'],
    ['emptyTitle', 'No tienes invitaciones'],
    ['emptyBody', 'Cuando una empresa te invite, aparecerá aquí.'],
    ['rejectedEmptyTitle', 'No tienes invitaciones pendientes'],
    [
      'rejectedEmptyBody',
      'Rechazaste la invitación. No hubo ningún cambio en tu cuenta y seguirás operando en modo personal.',
    ],
    ['joinedRole', 'Rol: Miembro'],
    ['joinedBadge', 'Unido'],
    ['stayPersonal', 'Seguir en personal'],
    ['switcherEntry', 'Mis invitaciones'],
    ['justJoined', 'Recién te uniste'],
    ['accepting', 'Aceptando...'],
    ['rejecting', 'Rechazando...'],
    ['inboxRetry', 'Reintentar'],
    ['acceptError', 'No se pudo aceptar la invitación. Intenta nuevamente.'],
    ['rejectError', 'No se pudo rechazar la invitación. Intenta nuevamente.'],
  ] as const)('WS62: %s resolves to the approved string', (key, expected) => {
    expect(INVITATION_COPY[key]).toBe(expected);
  });

  it('WS62: the parameterised rows interpolate their argument', () => {
    expect(INVITATION_COPY.inboxInvitedBy('María López')).toBe('Invitada por María López');
    expect(INVITATION_COPY.inboxExpiresInDays(5)).toBe('en 5 días');
    expect(INVITATION_COPY.expiredNoticeBody('Andina')).toBe(
      'La invitación expiró. Pide al administrador de Andina que te envíe una nueva.',
    );
    expect(INVITATION_COPY.joinedTitle('Andina')).toBe('Te uniste a Andina');
    expect(INVITATION_COPY.operateAs('Andina')).toBe('Operar como Andina');
  });

  it('IC-68: the confirmation body keeps the organization name apart so the card can bold it', () => {
    const body = INVITATION_COPY.joinedBody('Importadora Andina S.A.');

    expect(body.name).toBe('Importadora Andina S.A.');
    expect(`${body.lead}${body.name}${body.tail}`).toBe(
      'Ya eres miembro de Importadora Andina S.A.. El selector de contexto, arriba a la derecha, ahora te deja operar en su nombre.',
    );
  });

  it('WS62: the rows reused from HUE-01 keep their approved text', () => {
    expect(INVITATION_COPY.listLoading).toBe('Cargando invitaciones…');
    expect(INVITATION_COPY.listError).toBe('No pudimos cargar las invitaciones');
    expect(INVITATION_COPY.statusLabel.pending).toBe('Pendiente');
    expect(INVITATION_COPY.statusLabel.expired).toBe('Expirada');
  });

  it('WS62: the retired request-a-new-invitation action has no copy row', () => {
    const allStrings = JSON.stringify(Object.values(INVITATION_COPY).filter((value) => typeof value === 'string'));

    expect(allStrings).not.toMatch(/Solicitar nueva invitación/);
  });

  it('WS76 WS82: {short} and the initials come from the existing organization helpers', () => {
    const name = 'Importadora Andina S.A.';

    expect(INVITATION_COPY.operateAs(organizationShortName(name))).toBe('Operar como Importadora Andina');
    expect(INVITATION_COPY.expiredNoticeBody(organizationShortName(name))).toContain('de Importadora Andina que');
    expect(organizationInitials(name)).toBe('IA');
  });
});

describe('INVITATION_COPY.drawerEntry (IC-74)', () => {
  it('WS115: appends the count only when it is greater than zero', () => {
    expect(INVITATION_COPY.drawerEntry(2)).toBe('Mis invitaciones (2)');
    expect(INVITATION_COPY.drawerEntry(1)).toBe('Mis invitaciones (1)');
    expect(INVITATION_COPY.drawerEntry(0)).toBe('Mis invitaciones');
  });
});

describe('formatInvitationExpiry', () => {
  const now = new Date('2026-06-10T12:00:00Z');
  const inMs = (ms: number) => new Date(now.getTime() + ms).toISOString();
  const DAY = 24 * 60 * 60 * 1000;

  it('WS71: five whole days ahead reads en 5 días', () => {
    expect(formatInvitationExpiry(inMs(5 * DAY), now)).toBe('en 5 días');
  });

  it('WS71: a partial day rounds up (4.2 days ahead is en 5 días)', () => {
    expect(formatInvitationExpiry(inMs(4.2 * DAY), now)).toBe('en 5 días');
  });

  it('WS71 IC-58: one day or less reads en 1 día', () => {
    expect(formatInvitationExpiry(inMs(DAY), now)).toBe('en 1 día');
    expect(formatInvitationExpiry(inMs(DAY / 2), now)).toBe('en 1 día');
    expect(formatInvitationExpiry(inMs(1000), now)).toBe('en 1 día');
  });

  it('WS71: just over one day is already en 2 días', () => {
    expect(formatInvitationExpiry(inMs(DAY + 1000), now)).toBe('en 2 días');
  });

  it('WS78: exactly now and a moment in the past still read en 1 día', () => {
    expect(formatInvitationExpiry(now.toISOString(), now)).toBe('en 1 día');
    expect(formatInvitationExpiry(inMs(-3 * DAY), now)).toBe('en 1 día');
  });

  it('defaults the reference clock to the current time', () => {
    const inThreeDays = new Date(Date.now() + 3 * DAY - 60_000).toISOString();

    expect(formatInvitationExpiry(inThreeDays)).toBe('en 3 días');
  });

  it('returns an empty string for an unparseable value instead of NaN days', () => {
    expect(formatInvitationExpiry('not-a-date', now)).toBe('');
  });
});

describe('resolveRespondFailure', () => {
  it.each([
    [RESPOND_ACTION.ACCEPT, 404, 'Invitación no encontrada'],
    [RESPOND_ACTION.ACCEPT, 409, 'Ya respondiste esta invitación'],
    [RESPOND_ACTION.REJECT, 404, 'Invitación no encontrada'],
    [RESPOND_ACTION.REJECT, 409, 'Esta invitación ya no está disponible'],
  ] as const)('WS87 WS88: a %s %i shows the server text verbatim and asks for a reload', (action, status, message) => {
    expect(resolveRespondFailure(apiError(status, { message }), action)).toEqual({ message, reload: true });
  });

  it('WS89 WS91: a 403 on accept shows the generic accept error and does not reload', () => {
    expect(resolveRespondFailure(apiError(403, { message: 'No autorizado' }), RESPOND_ACTION.ACCEPT)).toEqual({
      message: 'No se pudo aceptar la invitación. Intenta nuevamente.',
      reload: false,
    });
  });

  it('WS90 WS91: a 403 on reject shows the generic reject error', () => {
    expect(resolveRespondFailure(apiError(403, { message: 'No autorizado' }), RESPOND_ACTION.REJECT)).toEqual({
      message: 'No se pudo rechazar la invitación. Intenta nuevamente.',
      reload: false,
    });
  });

  it('WS89 WS90: a network error shows the generic copy of its action', () => {
    expect(resolveRespondFailure(new Error('Network Error'), RESPOND_ACTION.ACCEPT).message).toBe(
      'No se pudo aceptar la invitación. Intenta nuevamente.',
    );
    expect(resolveRespondFailure(new Error('Network Error'), RESPOND_ACTION.REJECT).message).toBe(
      'No se pudo rechazar la invitación. Intenta nuevamente.',
    );
  });

  it('WS92: framework text of a 5xx is never returned', () => {
    const result = resolveRespondFailure(apiError(500, { message: 'Server Error' }), RESPOND_ACTION.ACCEPT);

    expect(result).toEqual({ message: 'No se pudo aceptar la invitación. Intenta nuevamente.', reload: false });
  });

  it('only 404 and 409 carry server text: a 422 body is not rendered', () => {
    const result = resolveRespondFailure(
      apiError(422, { message: 'x', errors: { email: ['no mostrar'] } }),
      RESPOND_ACTION.REJECT,
    );

    expect(result).toEqual({ message: 'No se pudo rechazar la invitación. Intenta nuevamente.', reload: false });
  });

  it('a 409 without usable text falls back to the generic copy but still reloads', () => {
    expect(resolveRespondFailure(apiError(409, {}), RESPOND_ACTION.ACCEPT)).toEqual({
      message: 'No se pudo aceptar la invitación. Intenta nuevamente.',
      reload: true,
    });
  });
});
