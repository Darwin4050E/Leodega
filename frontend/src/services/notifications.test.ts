import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  getNotifications,
  markNotificationRead,
  getUnreadNotificationsCount,
  hasPaidReservationData,
  type AppNotification,
} from './notifications';

describe('notifications service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getNotifications calls GET /notifications', () => {
    getNotifications();
    expect(mockApi.get).toHaveBeenCalledWith('/notifications');
  });

  it('markNotificationRead posts to /notifications/:id/read', () => {
    markNotificationRead(5);
    expect(mockApi.post).toHaveBeenCalledWith('/notifications/5/read');
  });

  it('getUnreadNotificationsCount calls GET /notifications-unread-count', () => {
    getUnreadNotificationsCount();
    expect(mockApi.get).toHaveBeenCalledWith('/notifications-unread-count');
  });
});

describe('hasPaidReservationData', () => {
  const base: AppNotification = {
    id: 1,
    title: 'Bodega reservada y pagada',
    body: 'Tu bodega fue reservada y el pago quedó confirmado',
    type: 'reservation_booked_and_paid',
    is_read: false,
    data: {
      reservation_id: 10,
      store_room_id: 20,
      customer_name: 'Ana Torres',
      store_room_title: 'Bodega Norte',
      amount: '3000.00',
      start_date: '2026-02-01',
      end_date: '2026-05-01',
    },
  };

  it('returns true when type matches and every required field has the right runtime type', () => {
    expect(hasPaidReservationData(base)).toBe(true);
  });

  it('returns true when amount is a number instead of a string', () => {
    expect(hasPaidReservationData({ ...base, data: { ...base.data, amount: 3000 } })).toBe(true);
  });

  it('returns false when data is absent (legacy notification row)', () => {
    expect(hasPaidReservationData({ ...base, data: null })).toBe(false);
  });

  it('returns false when data is missing a required field', () => {
    const incomplete: Record<string, unknown> = { ...(base.data as Record<string, unknown>) };
    delete incomplete.customer_name;
    expect(hasPaidReservationData({ ...base, data: incomplete })).toBe(false);
  });

  it('returns false when a required field has the wrong runtime type', () => {
    expect(hasPaidReservationData({ ...base, data: { ...base.data, start_date: 123 } })).toBe(false);
  });

  it('returns false when the notification type does not match, even with full data', () => {
    expect(hasPaidReservationData({ ...base, type: 'store_reported' })).toBe(false);
  });
});
