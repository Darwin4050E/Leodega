import api from "../api/axios";

export interface StoreRoomDetail {
  title?: string;
  description?: string;
  direction?: string;
  city?: string;
  security?: string;
  size?: number;
  room_type?: string;
  storage_type?: string;
  photos?: string[];
  prices?: { price: number }[];
  landlord?: {
    id?: number;
    user_id?: number;
    name?: string;
    lastname?: string;
    email?: string;
  };
}

export interface StoreRoomSummary {
  id: number;
  title: string;
  city: string;
  size: number;
  publication_status: "approved" | "pending" | "rejected";
  landlord?: {
    id?: number;
    user?: {
      name?: string;
      email?: string;
      phone?: string;
    };
  };
  user_id?: number;
  store_prices?: { price: number }[];
  rating_avg?: number;
  rating_count?: number;
  image?: string | null;
}

export function getStoreRooms() {
  return api.get<StoreRoomSummary[]>("/storeRooms");
}

export function getStoreRoomDetail(id: number | string) {
  return api.get<StoreRoomDetail>(`/store-rooms/${id}/detail`);
}

export function createStoreRoom(data: Record<string, unknown>) {
  return api.post("/storeRooms", data);
}

export function updateStoreRoom(id: number | string, data: Record<string, unknown>) {
  return api.put(`/storeRooms/${id}`, data);
}

export function getStoreRoomsByLandlord(landlordId: number | string) {
  return api.get(`landlords/${landlordId}/storeRooms`);
}

export function uploadStoreRoomPhotos(storeRoomId: number | string, formData: FormData) {
  return api.post(`/store-rooms/${storeRoomId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
