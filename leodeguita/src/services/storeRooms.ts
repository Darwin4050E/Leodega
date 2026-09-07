import axios from 'axios'
import client from '../api/client'

/**
 * HUL-03: publish a storeroom for review from the mobile companion.
 *
 * Leodeguita hits the same `POST /api/storeRooms` endpoint as the web wizard
 * (HUG-04), then chains photo uploads to `POST /store-rooms/{id}/photos` just
 * like the web does. Every business rule (required fields, fire-department
 * permit, duplicate-title guard) lives in the backend, never here.
 */

export type RoomType =
  | 'habitacion'
  | 'garaje'
  | 'contenedor'
  | 'sotano'
  | 'atico'
  | 'bodega'

export type StorageType = 'completa' | 'privado' | 'compartido'

export type CancellationPolicyTier = 'flexible' | 'moderada' | 'estricta'

export interface NewStoreRoom {
  room_type: RoomType | ''
  storage_type: StorageType | ''
  photos: File[]
  direction: string
  city: string
  title: string
  description: string
  monthly_price: string
  size: string
  security: Record<string, boolean>
  cancellation_policy_tier: CancellationPolicyTier | ''
  permit: File | null
}

export interface CreateStoreRoomResult {
  item: { id: number; title: string; publication_status: string }
  message: string
  status: number
}

/**
 * Shape of the legacy validation envelope the backend returns on a 400
 * (StoreStoreRoomRequest::failedValidation): `errors` maps a field name to
 * its messages.
 */
export interface ApiValidationError {
  message: string
  errors?: Record<string, string[]>
  status?: number
}

export async function createStoreRoom(
  data: NewStoreRoom,
): Promise<CreateStoreRoomResult> {
  const form = new FormData()
  form.append('room_type', data.room_type)
  form.append('storage_type', data.storage_type)
  form.append('direction', data.direction.trim())
  form.append('city', data.city.trim())
  form.append('title', data.title.trim())
  form.append('description', data.description.trim())
  form.append('size', data.size)
  form.append('security', JSON.stringify(data.security))
  form.append('cancellation_policy_tier', data.cancellation_policy_tier)

  if (data.permit) {
    form.append('firefighter_permit', data.permit)
  }

  form.append('storePrices[0][mode]', 'month')
  form.append('storePrices[0][price]', data.monthly_price)
  form.append('storePrices[0][disponibility]', 'true')

  const { data: body } = await client.post<CreateStoreRoomResult>(
    '/storeRooms',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return body
}

export async function uploadStoreRoomPhotos(
  storeRoomId: number,
  photos: File[],
): Promise<void> {
  if (photos.length === 0) return

  const form = new FormData()
  for (const photo of photos) {
    form.append('photos[]', photo)
  }

  await client.post(`/store-rooms/${storeRoomId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/**
 * HUL-04: list the store rooms owned by the signed-in gestor for the
 * `/mis-bodegas` overview.
 *
 * `GET /api/landlords/{id}/storeRooms` (StoreRoomsController::getByLandlord)
 * returns one object per non-deleted room. Phase 1 of this change made it
 * answer `200 []` for an existing landlord with no rooms, but a stale backend
 * (or the unknown-landlord case) can still answer `404`; we swallow that into
 * an empty list here so the screen never has to know HTTP codes. Every other
 * error rethrows.
 */

export type PublicationStatus = 'pending' | 'approved' | 'rejected'

export interface StorePrice {
  mode: string
  price: string | number
  disponibility: string | number | boolean
  [key: string]: unknown
}

export interface MyStoreRoom {
  id: number
  title: string
  direction: string
  city: string
  size: number | string
  publication_status: PublicationStatus
  storage_type: StorageType
  room_type: RoomType
  active_reservations_count: number
  image: string | null
  storePrices: StorePrice[]
}

export async function listMyStoreRooms(
  landlordId: number,
): Promise<MyStoreRoom[]> {
  try {
    const { data } = await client.get<
      (Omit<MyStoreRoom, 'storePrices'> & { store_prices?: StorePrice[] })[]
    >(`/landlords/${landlordId}/storeRooms`)

    return data.map(({ store_prices, ...room }) => ({
      ...room,
      storePrices: store_prices ?? [],
    }))
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return []
    }
    throw error
  }
}
