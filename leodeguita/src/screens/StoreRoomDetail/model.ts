import type { StoreRoomDetail } from '../../services/storeRooms'

/**
 * Pure screen logic for `/bodegas/:id`. Predicates decide which
 * optional sections `StoreRoomDetailView` renders (spec "Optional Field
 * Omission") — kept render-free so they are unit-testable without mounting
 * React, mirroring `PublishStoreRoom/model.ts` and `MyStoreRooms/model.ts`.
 */

export function hasCoordinates(detail: StoreRoomDetail): boolean {
  return detail.latitude !== null && detail.longitude !== null
}

export function hasPhotos(detail: StoreRoomDetail): boolean {
  return detail.photos.length > 0
}

export function monthlyPrice(detail: StoreRoomDetail): string | null {
  const price =
    detail.prices.find((entry) => entry.mode === 'month') ?? detail.prices[0]
  if (!price) return null
  const amount = Number(price.price)
  return Number.isFinite(amount) ? `$${amount}` : `$${price.price}`
}

/**
 * `security` is served as a raw JSON string (see
 * `StoreRoomDetailResource::toArray()`'s docblock — the endpoint predates
 * the typed `SecurityFeatures` cast). Parse it defensively: malformed input
 * degrades to an empty list instead of throwing, same spirit as the web
 * `BodegaDetalle.tsx` consumer but without letting a bad payload crash the
 * screen.
 */
export function parseSecurity(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return []
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
  } catch {
    return []
  }
}

export interface AvailabilityStat {
  value: string
  available: boolean
}

/** Drives the 3rd stat box's "Disponible" cell and the unavailable banner. */
export function availabilityStat(isAvailableNow: boolean): AvailabilityStat {
  return isAvailableNow
    ? { value: 'Ahora', available: true }
    : { value: 'No disponible', available: false }
}
