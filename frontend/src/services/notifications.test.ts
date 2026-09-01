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
