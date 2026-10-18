import { asApiError } from "../api/errors";
import { InvitationStatus } from "../services/organizations";

/**
 * Spanish copy of the organization-invitations UI (spec strings IC-*), kept in
 * one place so rewording an approved string is a one-line change. Server
 * refusals (IC-1..IC-4, IC-7, IC-11..IC-13) are not listed: the page renders
 * them verbatim from the response.
 */
export const INVITATION_COPY = {
  title: "Invitar miembros",
  subtitle: (organizationName: string) =>
    `Suma clientes a ${organizationName} buscándolos por correo. Tú decides quién puede reservar en nombre de la empresa.`,
  emailLabel: "Buscar usuario por correo",
  emailPlaceholder: "nombre@correo.com",
  helper: "Solo clientes pueden unirse; los gestores de bodega no.",
  submit: "Enviar invitación",
  submitting: "Enviando...",
  blankEmail: "Escribe el correo del cliente que quieres invitar.",
  invalidEmail: "Ingresa un correo válido.",
  clientNoticeTitle: "Ingresa un correo",
  refusalTitle: "No puedes invitar a este correo",
  successTitle: "Invitación enviada",
  successBody: (email: string) =>
    `Le avisamos a ${email} en su cuenta de cliente. Aparecerá en su bandeja de invitaciones.`,
  successToast: (email: string) => `Invitación enviada a ${email}`,
  sendError: "No se pudo enviar la invitación. Intenta nuevamente.",
  listHeading: "Invitaciones",
  counter: (pending: number, total: number) => `${pending} pendientes · ${total} en total`,
  listLoading: "Cargando invitaciones…",
  listEmpty: "Aún no has enviado invitaciones.",
  listError: "No pudimos cargar las invitaciones",
  sentOn: (date: string) => `enviada ${date}`,
  expiresOn: (date: string) => `vence ${date}`,
  invitedBy: (name: string) => `invitada por ${name}`,
  statusLabel: {
    [InvitationStatus.PENDING]: "Pendiente",
    [InvitationStatus.ACCEPTED]: "Aceptada",
    [InvitationStatus.REJECTED]: "Rechazada",
    [InvitationStatus.EXPIRED]: "Expirada",
    [InvitationStatus.CANCELLED]: "Cancelada",
  } satisfies Record<InvitationStatus, string>,
  revoke: "Revocar",
  revoking: "Revocando...",
  revokedToast: "Invitación revocada",
  revokeError: "No se pudo revocar la invitación. Intenta nuevamente.",
  noOrganization: "Selecciona una organización para invitar miembros.",
  memberViewTitle: "Vista de miembro",
  memberViewBody: "Eres miembro de esta organización. Solo el administrador puede invitar o quitar miembros.",
  entryButton: "Invitar",
  previousPage: "Anterior",
  nextPage: "Siguiente",
  pageOf: (page: number, lastPage: number) => `Página ${page} de ${lastPage}`,
  // Invitee side (IC-48..IC-79). Server-sent refusals (IC-80..IC-84) are not
  // listed: they are rendered verbatim from the response.
  inboxTitle: "Invitaciones",
  inboxSubtitle: "Organizaciones que te invitaron a operar en su nombre.",
  inboxEyebrow: "Te invitaron a unirte",
  inboxInvitedBy: (name: string) => `Invitada por ${name}`,
  inboxRoleLabel: "Rol",
  inboxRoleValue: "Miembro",
  inboxPermissionLabel: "Al aceptar podrás",
  inboxPermissionValue: "Reservar a nombre de la empresa",
  inboxExpiresLabel: "Vence",
  inboxExpiresInDays: (days: number) => `en ${days} días`,
  inboxExpiresInOneDay: "en 1 día",
  acceptInvitation: "Aceptar invitación",
  rejectInvitation: "Rechazar",
  expiredNoticeTitle: "Esta invitación ya no está disponible",
  expiredNoticeBody: (shortName: string) =>
    `La invitación expiró. Pide al administrador de ${shortName} que te envíe una nueva.`,
  emptyTitle: "No tienes invitaciones",
  emptyBody: "Cuando una empresa te invite, aparecerá aquí.",
  rejectedEmptyTitle: "No tienes invitaciones pendientes",
  rejectedEmptyBody:
    "Rechazaste la invitación. No hubo ningún cambio en tu cuenta y seguirás operando en modo personal.",
  joinedTitle: (shortName: string) => `Te uniste a ${shortName}`,
  /** Split around the organization name so the card can render it in bold. */
  joinedBody: (organizationName: string) => ({
    lead: "Ya eres miembro de ",
    name: organizationName,
    tail: ". El selector de contexto, arriba a la derecha, ahora te deja operar en su nombre.",
  }),
  joinedRole: "Rol: Miembro",
  joinedBadge: "Unido",
  stayPersonal: "Seguir en personal",
  operateAs: (shortName: string) => `Operar como ${shortName}`,
  switcherEntry: "Mis invitaciones",
  /** The count is appended only when there is something pending. */
  drawerEntry: (pending: number) => (pending > 0 ? `Mis invitaciones (${pending})` : "Mis invitaciones"),
  justJoined: "Recién te uniste",
  accepting: "Aceptando...",
  rejecting: "Rechazando...",
  acceptError: "No se pudo aceptar la invitación. Intenta nuevamente.",
  rejectError: "No se pudo rechazar la invitación. Intenta nuevamente.",
} as const;

const dateFormatter = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric" });

/**
 * "08 jun 2026". Some ICU builds abbreviate the Spanish month with a trailing
 * period, which the approved copy does not use.
 */
export function formatInvitationDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateFormatter.format(parsed).replaceAll(".", "");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * "en 5 días" / "en 1 día" for the invitee card. Whole days are rounded up and
 * never drop below one; the status itself always comes from the server, so a
 * deadline already past still reads "en 1 día" rather than a negative count.
 */
export function formatInvitationExpiry(expiresAtIso: string, now: Date = new Date()): string {
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) return "";

  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
  return days <= 1 ? INVITATION_COPY.inboxExpiresInOneDay : INVITATION_COPY.inboxExpiresInDays(days);
}

export const INVITATION_FAILURE = {
  /** The server says the caller is not an admin: the page switches to the member view. */
  FORBIDDEN: "forbidden",
  MESSAGE: "message",
} as const;

export type InvitationFailure =
  | { kind: typeof INVITATION_FAILURE.FORBIDDEN }
  | { kind: typeof INVITATION_FAILURE.MESSAGE; message: string };

// Statuses whose body is a deliberate, user-facing refusal. Anything else
// (5xx, network) carries framework text that must never reach the screen.
const SERVER_TEXT_STATUSES = new Set([404, 409, 422, 429]);

/**
 * Maps a failed invite or revoke request to what the page renders: the
 * member-view signal on 403, the server text on a deliberate refusal
 * (`errors.email[0]`, else `errors.organization[0]`, else `message`) and the
 * caller's generic copy for everything else.
 */
export function resolveInvitationFailure(error: unknown, fallback: string): InvitationFailure {
  const response = asApiError(error).response;
  if (response?.status === 403) return { kind: INVITATION_FAILURE.FORBIDDEN };

  if (response?.status !== undefined && SERVER_TEXT_STATUSES.has(response.status)) {
    const data = response.data;
    const text = data?.errors?.email?.[0] || data?.errors?.organization?.[0] || data?.message;
    if (text) return { kind: INVITATION_FAILURE.MESSAGE, message: text };
  }

  return { kind: INVITATION_FAILURE.MESSAGE, message: fallback };
}

export const RESPOND_ACTION = {
  ACCEPT: "accept",
  REJECT: "reject",
} as const;

export type RespondAction = (typeof RESPOND_ACTION)[keyof typeof RESPOND_ACTION];

export interface RespondFailure {
  message: string;
  /** The row is stale (already answered, expired or gone): the page reloads the inbox. */
  reload: boolean;
}

// Only these two statuses carry a deliberate server refusal on accept/reject.
const RESPOND_TEXT_STATUSES = new Set([404, 409]);

/**
 * Maps a failed accept or reject request to what the card renders. A 404/409
 * shows the server text verbatim and asks the page to reload the inbox; every
 * other failure (403, 422, 5xx, network) shows the generic copy of the action.
 */
export function resolveRespondFailure(error: unknown, action: RespondAction): RespondFailure {
  const fallback = action === RESPOND_ACTION.ACCEPT ? INVITATION_COPY.acceptError : INVITATION_COPY.rejectError;
  const response = asApiError(error).response;

  if (response?.status !== undefined && RESPOND_TEXT_STATUSES.has(response.status)) {
    return { message: response.data?.message || fallback, reload: true };
  }

  return { message: fallback, reload: false };
}
