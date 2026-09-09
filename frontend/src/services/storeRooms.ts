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
  prices?: { id?: number; mode?: string; price: number; disponibility?: boolean | number }[];
  active_reservations_count?: number;
  publication_status?: "approved" | "pending" | "rejected";
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
  active_reservations_count?: number;
}

export function getStoreRooms() {
  return api.get<StoreRoomSummary[]>("/storeRooms");
}

export function getStoreRoomDetail(id: number | string) {
  return api.get<StoreRoomDetail>(`/store-rooms/${id}/detail`);
}

export function createStoreRoom(formData: FormData) {
  return api.post("/storeRooms", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export interface UpdateStoreRoomResponse {
  data: StoreRoomSummary & { storePrices?: { mode?: string; price: number; disponibility?: boolean | number }[] };
  message: string;
  status: number;
  /**
   * HUG-08 scenario 3: present only when the edited room has active/future
   * confirmed reservations. Absent otherwise.
   */
  notice?: string;
}

export function updateStoreRoom(id: number | string, data: Record<string, unknown>) {
  return api.put<UpdateStoreRoomResponse>(`/storeRooms/${id}`, data);
}

export function getStoreRoomsByLandlord(landlordId: number | string) {
  return api.get(`landlords/${landlordId}/storeRooms`);
}

export function uploadStoreRoomPhotos(storeRoomId: number | string, formData: FormData) {
  return api.post(`/store-rooms/${storeRoomId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteStoreRoom(id: number | string) {
  return api.delete(`/storeRooms/${id}`);
}

export interface Landlord {
  name: string | null;
  email: string | null;
}

export interface SecurityFeatures {
  camara: boolean;
  ruido: boolean;
  control: boolean;
  acceso: boolean;
}

export const REASON_CODE = {
  FOTOS: "fotos",
  INFO: "info",
  PERMISO: "permiso",
  OTRO: "otro",
} as const;
export type ReasonCode = (typeof REASON_CODE)[keyof typeof REASON_CODE];

export interface ModerationHistoryEntry {
  status: "approved" | "pending" | "rejected";
  reason_code: ReasonCode | null;
  reason_rejected: string | null;
  admin_id: number | null;
  moderation_date: string;
  permit_waived_at: string | null;
}

export interface StoreRoomModerationDetail {
  id: number;
  title: string;
  landlord: Landlord;
  submitted_at: string;
  photos: string[];
  direction: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  size: number;
  monthly_price: number;
  leodega_fee: number;
  landlord_share: number;
  description: string | null;
  cancellation_policy_tier: string | null;
  security: SecurityFeatures;
  permit_attached: boolean;
  permit_filename: string | null;
  moderation_history: ModerationHistoryEntry[];
  room_type: string | null;
  storage_type: string | null;
}

export function getPendingStoreRooms() {
  return api.get<StoreRoomModerationDetail[]>("/store-rooms/pending");
}

export function downloadStoreRoomPermit(id: number | string) {
  return api.get<Blob>(`/store-rooms/${id}/permit/download`, { responseType: "blob" });
}
