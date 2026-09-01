import api from "../api/axios";

export interface AppNotification {
  id: number;
  title: string;
  body?: string;
  type: string;
  read_at?: string | null;
}

export function getNotifications() {
  return api.get<AppNotification[]>("/notifications");
}

export function markNotificationRead(id: number | string) {
  return api.post(`/notifications/${id}/read`);
}

export function getUnreadNotificationsCount() {
  return api.get("/notifications-unread-count");
}
