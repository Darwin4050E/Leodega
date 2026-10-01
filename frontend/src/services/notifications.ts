import api from "../api/axios";

export interface ReservationBookedAndPaidData {
  reservation_id: number;
  store_room_id: number;
  customer_name: string;
  store_room_title: string;
  amount: string | number;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

export interface AppNotification {
  id: number;
  title: string;
  body?: string;
  type: string;
  is_read: boolean;
  data?: Record<string, unknown> | null;
}

export function hasPaidReservationData(
  n: AppNotification
): n is AppNotification & { data: ReservationBookedAndPaidData } {
  if (n.type !== "reservation_booked_and_paid" || !n.data) {
    return false;
  }

  const d = n.data;
  return (
    typeof d.customer_name === "string" &&
    typeof d.store_room_title === "string" &&
    (typeof d.amount === "string" || typeof d.amount === "number") &&
    typeof d.start_date === "string" &&
    typeof d.end_date === "string"
  );
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
