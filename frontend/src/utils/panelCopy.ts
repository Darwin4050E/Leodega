import { INVITATION_COPY } from "./invitationCopy";

/**
 * Spanish copy of the organization control panel (spec strings PC-*), kept in
 * one place so rewording an approved string is a one-line change. Existing
 * strings (retry, pagination) are reused from the invitations copy rather than
 * duplicated. PC-25 (Q3 a), PC-31 and PC-32 are intentionally unused and have no entry.
 * Server refusals (403) are rendered verbatim and are not listed here.
 */
export const PANEL_COPY = {
  title: "Panel de la empresa",
  ribbonLink: "Ver panel",
  subtitle: (shortName: string) => `Miembros, reservas y actividad de ${shortName}`,
  ruc: (ruc: string) => `RUC ${ruc}`,
  adminBadge: "Administrador",
  memberBadge: "Miembro",
  memberNoticeTitle: "Vista de miembro",
  memberNoticeBody:
    "Eres miembro de esta organización. Puedes ver los miembros y las reservas; solo el administrador puede ver el historial, invitar miembros, recargar saldo y fijar límites.",
  noOrganization: "Selecciona una organización para ver el panel.",
  loading: "Cargando…",
  membersLabel: "Miembros activos",
  membersSub: "Incluido el administrador",
  reservationsLabel: "Reservas vigentes",
  reservationsSubAdmin: "A nombre de la organización",
  reservationsSubMember: "Hechas por ti",
  pendingLabel: "Invitaciones pendientes",
  pendingSub: "Esperando respuesta",
  summaryError: "No pudimos cargar el resumen",
  retry: INVITATION_COPY.inboxRetry,
  walletTitle: "Billetera de la empresa",
  walletSubtitle: "Las reservas de la organización se pagan con este saldo, no con la tarjeta de cada miembro",
  walletBalanceLabel: "Saldo disponible",
  walletCurrency: "USD",
  walletEmptyBadge: "Sin saldo",
  walletLink: "Ver billetera",
  walletError: "No pudimos cargar el saldo",
  membersTitle: "Miembros",
  membersSubtitleAdmin: "Límite de gasto mensual por miembro · se reinicia el día 1 de cada mes",
  membersSubtitleMember: "Solo ves tu propio consumo mensual",
  memberColumn: "Miembro",
  limitColumn: "Límite mensual",
  spentColumn: "Consumido este mes",
  noLimit: "Sin límite",
  limitPerMonth: (amount: string) => `${amount} /mes`,
  spentOfLimit: (spent: string, limit: string) => `${spent} de ${limit}`,
  selfMarker: "· tú",
  since: (date: string) => `desde ${date}`,
  unlimitedSpent: "· sin tope",
  inviteLink: "Invitar",
  manageLimitsLink: "Gestionar límites",
  membersError: "No pudimos cargar los miembros",
} as const;
