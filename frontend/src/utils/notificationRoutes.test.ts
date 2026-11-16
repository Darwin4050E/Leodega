import { describe, it, expect } from 'vitest';
import { NOTIFICATION_TYPE, resolveNotificationRoute } from './notificationRoutes';

describe('resolveNotificationRoute', () => {
  it.each([
    [NOTIFICATION_TYPE.STORE_REPORTED, '/admin/solicitudes'],
    [NOTIFICATION_TYPE.RESERVATION_BOOKED_AND_PAID, '/arrendador/solicitudes'],
    [NOTIFICATION_TYPE.RESERVATION_EXPIRED, '/arrendador/solicitudes'],
  ])('WS127: keeps the existing destination of %s', (type, path) => {
    expect(resolveNotificationRoute(type)).toBe(path);
  });

  it('INV-WS55: sends an organization_invitation to the invitee inbox', () => {
    expect(resolveNotificationRoute('organization_invitation')).toBe('/mi-cuenta/invitaciones');
  });

  it.each(['organization_invitation_accepted', 'organization_invitation_rejected'])(
    'WS122 WS123: sends %s to the members page',
    (type) => {
      expect(resolveNotificationRoute(type)).toBe('/organizacion/miembros');
    },
  );

  it('WS121: returns null for an unknown future type', () => {
    expect(resolveNotificationRoute('something_new')).toBeNull();
  });

  it('returns null for an empty type', () => {
    expect(resolveNotificationRoute('')).toBeNull();
  });

  it('does not match inherited object keys', () => {
    expect(resolveNotificationRoute('constructor')).toBeNull();
    expect(resolveNotificationRoute('toString')).toBeNull();
  });

  it('WS126: depends on the type alone, so a notification payload cannot change the destination', () => {
    expect(resolveNotificationRoute.length).toBe(1);
  });
});

describe('NOTIFICATION_TYPE', () => {
  it('exposes the backend type strings', () => {
    expect(NOTIFICATION_TYPE.ORGANIZATION_INVITATION).toBe('organization_invitation');
    expect(NOTIFICATION_TYPE.ORGANIZATION_INVITATION_ACCEPTED).toBe('organization_invitation_accepted');
    expect(NOTIFICATION_TYPE.ORGANIZATION_INVITATION_REJECTED).toBe('organization_invitation_rejected');
  });
});
