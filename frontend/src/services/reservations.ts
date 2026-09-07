import api from "../api/axios";

export interface LandlordReservation {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  store_room_id: number;
  rent_subtotal: string | number | null;
  total_mount: string | number | null;
  cancelation_reason: string | null;
  payment_status: "paid" | "pending";
  has_refund_obligation: boolean;
  /**
   * Server-computed cancel eligibility, from the same method the cancel guard
   * enforces. Authoritative — never re-derive it client-side, or the button
   * and the endpoint will disagree across a timezone boundary.
   */
  can_be_cancelled: boolean;
  storeRooms?: {
    id?: number;
    title?: string;
  };
  tenants?: {
    user?: {
      name?: string;
      lastname?: string;
      email?: string;
      phone?: string;
    };
  };
}

export function getLandlordReservations() {
  return api.get<LandlordReservation[]>("/landlord/reservations");
}

export function getReservedDates(storeRoomId: number | string) {
  return api.get(`/storeRooms/${storeRoomId}/reserved-dates`);
}

export function createReservation(data: {
  store_room_id: number;
  start_date: string;
  end_date: string;
}) {
  return api.post<{ message: string; reservation: LandlordReservation }>("/reservations", data);
}

export function cancelReservation(id: number | string, data: { reason: string }) {
  return api.patch<{ message: string; reservation: LandlordReservation }>(
    `/landlord/reservations/${id}/cancel`,
    data
  );
}

export function getCancellationRate() {
  return api.get<{ gestor_cancellation_penalty_rate: number }>(
    "/landlord/reservations/cancellation-rate"
  );
}
