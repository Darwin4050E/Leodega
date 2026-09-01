import api from "../api/axios";

export interface LandlordReservation {
  id: number;
  status: string;
  start_date: string;
  end_date: string;
  store_room_id: number;
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
  total_mount: number;
}) {
  return api.post("/reservations", data);
}

export function updateReservationStatus(id: number | string, data: Record<string, unknown>) {
  return api.patch(`/landlord/reservations/${id}/status`, data);
}
