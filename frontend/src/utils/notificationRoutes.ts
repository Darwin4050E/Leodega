/** Notification `type` strings sent by the backend that the dropdown can navigate for. */
export const NOTIFICATION_TYPE = {
  STORE_REPORTED: "store_reported",
  RESERVATION_BOOKED_AND_PAID: "reservation_booked_and_paid",
  RESERVATION_EXPIRED: "reservation_expired",
  ORGANIZATION_INVITATION: "organization_invitation",
  ORGANIZATION_INVITATION_ACCEPTED: "organization_invitation_accepted",
  ORGANIZATION_INVITATION_REJECTED: "organization_invitation_rejected",
} as const;

const NOTIFICATION_ROUTES: ReadonlyMap<string, string> = new Map([
  [NOTIFICATION_TYPE.STORE_REPORTED, "/admin/solicitudes"],
  [NOTIFICATION_TYPE.RESERVATION_BOOKED_AND_PAID, "/arrendador/solicitudes"],
  [NOTIFICATION_TYPE.RESERVATION_EXPIRED, "/arrendador/solicitudes"],
  [NOTIFICATION_TYPE.ORGANIZATION_INVITATION, "/mi-cuenta/invitaciones"],
  [NOTIFICATION_TYPE.ORGANIZATION_INVITATION_ACCEPTED, "/organizacion/miembros"],
  [NOTIFICATION_TYPE.ORGANIZATION_INVITATION_REJECTED, "/organizacion/miembros"],
]);

/**
 * Where a click on a notification of this type goes, or null when the type has
 * no destination (an unknown future type keeps the title-and-body fallback).
 * It reads the type only: the notification payload never decides the route.
 */
export function resolveNotificationRoute(type: string): string | null {
  return NOTIFICATION_ROUTES.get(type) ?? null;
}
