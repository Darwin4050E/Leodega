import { describe, it, expect } from 'vitest'
import type { StoreRoomDetail } from '../../services/storeRooms'
import {
  availabilityStat,
  hasCoordinates,
  hasPhotos,
  monthlyPrice,
  parseSecurity,
} from './model'

function detail(overrides: Partial<StoreRoomDetail> = {}): StoreRoomDetail {
  return {
    id: 1,
    title: 'Bodega Norte',
    description: 'Espacio amplio y seco',
    direction: 'Km 11.5 Vía a Daule',
    city: 'Guayaquil',
    size: 45,
    room_type: 'bodega',
    storage_type: 'completa',
    security: null,
    prices: [],
    photos: [],
    landlord: {
      id: 1,
      user_id: 2,
      name: 'Roberto Andrade',
      email: 'roberto@leodega.com',
      phone: '0991234567',
    },
    latitude: null,
    longitude: null,
    rating_avg: 4.5,
    rating_count: 3,
    active_reservations_count: 0,
    is_available_now: true,
    ...overrides,
  }
}

describe('hasCoordinates', () => {
  it('is true only when both latitude and longitude are set', () => {
    expect(
      hasCoordinates(detail({ latitude: -2.15, longitude: -79.9 })),
    ).toBe(true)
    expect(hasCoordinates(detail({ latitude: null, longitude: null }))).toBe(
      false,
    )
  })
})

describe('hasPhotos', () => {
  it('reflects whether the photos array has entries', () => {
    expect(hasPhotos(detail({ photos: ['a.jpg'] }))).toBe(true)
    expect(hasPhotos(detail({ photos: [] }))).toBe(false)
  })
})

describe('monthlyPrice', () => {
  it('prefers the month-mode price', () => {
    expect(
      monthlyPrice(
        detail({
          prices: [
            { mode: 'week', price: 40, disponibility: true },
            { mode: 'month', price: 150, disponibility: true },
          ],
        }),
      ),
    ).toBe('$150')
  })

  it('falls back to the first price when no month-mode entry exists', () => {
    expect(
      monthlyPrice(detail({ prices: [{ mode: 'week', price: 40, disponibility: true }] })),
    ).toBe('$40')
  })

  it('returns null when there are no prices', () => {
    expect(monthlyPrice(detail({ prices: [] }))).toBeNull()
  })
})

describe('parseSecurity', () => {
  it('returns the keys whose value is true', () => {
    expect(
      parseSecurity(JSON.stringify({ camara: true, ruido: false, acceso: true })),
    ).toEqual(['camara', 'acceso'])
  })

  it('returns an empty array for null', () => {
    expect(parseSecurity(null)).toEqual([])
  })

  it('returns an empty array for malformed JSON instead of throwing', () => {
    expect(parseSecurity('{not json')).toEqual([])
  })

  it('returns an empty array for a JSON value that is not an object', () => {
    expect(parseSecurity('"camara"')).toEqual([])
  })
})

describe('availabilityStat', () => {
  it('reads "Ahora" when available', () => {
    expect(availabilityStat(true)).toEqual({ value: 'Ahora', available: true })
  })

  it('reads "No disponible" when not available', () => {
    expect(availabilityStat(false)).toEqual({
      value: 'No disponible',
      available: false,
    })
  })
})
