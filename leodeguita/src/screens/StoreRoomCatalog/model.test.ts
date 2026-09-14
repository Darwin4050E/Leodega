import { describe, it, expect } from 'vitest'
import type { CatalogStoreRoom } from '../../services/storeRooms'
import { excludeUnavailable, monthlyPrice, toCardViewModel } from './model'

function room(overrides: Partial<CatalogStoreRoom> = {}): CatalogStoreRoom {
  return {
    id: 1,
    title: 'Bodega Norte',
    city: 'Guayaquil',
    size: 45,
    room_type: 'bodega',
    monthly_price: 150,
    rating_avg: 4.5,
    image: null,
    ...overrides,
  }
}

describe('monthlyPrice', () => {
  it('formats a numeric monthly price', () => {
    expect(monthlyPrice(room({ monthly_price: 150 }))).toBe('$150')
  })

  it('returns null when the price is not published', () => {
    expect(monthlyPrice(room({ monthly_price: null }))).toBeNull()
  })
})

describe('excludeUnavailable', () => {
  const rooms = [room({ id: 1 }), room({ id: 2 })]

  it('drops the matching id', () => {
    expect(excludeUnavailable(rooms, 1).map((r) => r.id)).toEqual([2])
  })

  it('returns every room when there is no id to exclude', () => {
    expect(excludeUnavailable(rooms, null)).toEqual(rooms)
  })

  it('returns every room when the id does not match any of them', () => {
    expect(excludeUnavailable(rooms, 99)).toEqual(rooms)
  })
})

describe('toCardViewModel', () => {
  it('maps a catalog room to a display-ready card', () => {
    expect(toCardViewModel(room())).toEqual({
      id: 1,
      title: 'Bodega Norte',
      city: 'Guayaquil',
      size: 45,
      typeLabel: 'Bodega independiente',
      price: '$150',
      rating: 4.5,
      image: null,
    })
  })

  it('falls back to the raw room_type value for an unknown type', () => {
    expect(
      toCardViewModel(room({ room_type: 'garbage' as CatalogStoreRoom['room_type'] }))
        .typeLabel,
    ).toBe('garbage')
  })
})
