import { ROOM_TYPES } from '../../lib/storeRoomLabels'
import type { CatalogStoreRoom } from '../../services/storeRooms'

/**
 * Pure screen logic for `/bodegas` (the mobile catalog). Kept
 * beside the screen and render-free, mirroring `MyStoreRooms/model.ts`, so
 * pricing, exclusion, and the card view-model are unit-testable without
 * mounting React.
 */

export function monthlyPrice(room: CatalogStoreRoom): string | null {
  return room.monthly_price !== null ? `$${room.monthly_price}` : null
}

/**
 * Drops `unavailableId` from the active list (spec "List Synchronization on
 * Unavailability" / design decision #3 — the detail screen pushes this id
 * back via react-router navigation state after showing an unavailability
 * notice).
 */
export function excludeUnavailable(
  rooms: CatalogStoreRoom[],
  unavailableId: number | null,
): CatalogStoreRoom[] {
  if (unavailableId === null) return rooms
  return rooms.filter((room) => room.id !== unavailableId)
}

const roomTypeLabel = (value: string): string =>
  ROOM_TYPES.find((type) => type.value === value)?.label ?? value

export interface CatalogCardViewModel {
  id: number
  title: string
  city: string
  size: number | string
  typeLabel: string
  price: string | null
  rating: number
  image: string | null
}

export function toCardViewModel(room: CatalogStoreRoom): CatalogCardViewModel {
  return {
    id: room.id,
    title: room.title,
    city: room.city,
    size: room.size,
    typeLabel: roomTypeLabel(room.room_type),
    price: monthlyPrice(room),
    rating: room.rating_avg,
    image: room.image,
  }
}
