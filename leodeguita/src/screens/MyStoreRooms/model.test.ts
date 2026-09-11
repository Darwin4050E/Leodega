import { describe, it, expect } from 'vitest'
import type { MyStoreRoom, PublicationStatus } from '../../services/storeRooms'
import { countByStatus, deriveStatus, filterRooms } from './model'

function room(overrides: Partial<MyStoreRoom> = {}): MyStoreRoom {
  return {
    id: 1,
    title: 'Bodega',
    direction: 'Calle 1',
    city: 'Guayaquil',
    size: 20,
    publication_status: 'approved',
    storage_type: 'completa',
    room_type: 'bodega',
    active_reservations_count: 0,
    image: null,
    storePrices: [],
    ...overrides,
  }
}

describe('deriveStatus precedence', () => {
  it('rejected outranks occupancy', () => {
    expect(
      deriveStatus(
        room({ publication_status: 'rejected', active_reservations_count: 2 }),
      ),
    ).toBe('rechazada')
  })

  it('pending with reservations is still pendiente', () => {
    expect(
      deriveStatus(
        room({ publication_status: 'pending', active_reservations_count: 2 }),
      ),
    ).toBe('pendiente')
  })

  it('an unknown status enum degrades to pendiente, never disponible', () => {
    expect(
      deriveStatus(
        room({
          publication_status: 'garbage' as PublicationStatus,
          active_reservations_count: 0,
        }),
      ),
    ).toBe('pendiente')
  })

  it('approved with reservations is ocupada', () => {
    expect(
      deriveStatus(
        room({ publication_status: 'approved', active_reservations_count: 2 }),
      ),
    ).toBe('ocupada')
  })

  it('approved with no reservations is disponible', () => {
    expect(
      deriveStatus(
        room({ publication_status: 'approved', active_reservations_count: 0 }),
      ),
    ).toBe('disponible')
  })
})

describe('countByStatus', () => {
  it('counts each derived status plus the total', () => {
    const rooms = [
      room({ id: 1, publication_status: 'approved', active_reservations_count: 0 }),
      room({ id: 2, publication_status: 'approved', active_reservations_count: 0 }),
      room({ id: 3, publication_status: 'approved', active_reservations_count: 3 }),
      room({ id: 4, publication_status: 'rejected', active_reservations_count: 0 }),
      room({ id: 5, publication_status: 'pending', active_reservations_count: 0 }),
    ]

    expect(countByStatus(rooms)).toEqual({
      todas: 5,
      disponible: 2,
      ocupada: 1,
      pendiente: 1,
      rechazada: 1,
    })
  })
})

describe('filterRooms', () => {
  const rooms = [
    room({ id: 1, publication_status: 'approved', active_reservations_count: 0 }),
    room({ id: 2, publication_status: 'approved', active_reservations_count: 0 }),
    room({ id: 3, publication_status: 'approved', active_reservations_count: 1 }),
  ]

  it('returns every room for "todas"', () => {
    expect(filterRooms(rooms, 'todas')).toHaveLength(3)
  })

  it('narrows to the selected derived status', () => {
    expect(filterRooms(rooms, 'disponible').map((r) => r.id)).toEqual([1, 2])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterRooms(rooms, 'rechazada')).toEqual([])
  })
})
