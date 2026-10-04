import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'
import client from '../api/client'
import {
  getStoreRoomDetail,
  listStoreRooms,
  StoreRoomNotFoundError,
  type CatalogStoreRoom,
  type StoreRoomDetail,
} from './storeRooms'

/**
 * Unit tests for the transport layer added for the mobile catalog and
 * detail screens. `client` is mocked directly (axios never leaves this
 * process) so these stay pure unit tests, no network and no React.
 */

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))

const getMock = vi.mocked(client.get)

function catalogRoom(overrides: Partial<CatalogStoreRoom> = {}): CatalogStoreRoom {
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

describe('listStoreRooms', () => {
  beforeEach(() => getMock.mockReset())

  it('returns the catalog payload from GET /storeRooms', async () => {
    const rooms = [catalogRoom()]
    getMock.mockResolvedValueOnce({ data: rooms })

    const result = await listStoreRooms()

    expect(client.get).toHaveBeenCalledWith('/storeRooms')
    expect(result).toEqual(rooms)
  })
})

describe('getStoreRoomDetail', () => {
  beforeEach(() => getMock.mockReset())

  it('returns the detail payload from GET /store-rooms/{id}/detail', async () => {
    getMock.mockResolvedValueOnce({ data: detail() })

    const result = await getStoreRoomDetail(1)

    expect(client.get).toHaveBeenCalledWith('/store-rooms/1/detail')
    expect(result).toEqual(detail())
  })

  it('rethrows a 404 as StoreRoomNotFoundError', async () => {
    getMock.mockRejectedValueOnce(
      new AxiosError('not found', undefined, undefined, undefined, {
        status: 404,
      } as never),
    )

    await expect(getStoreRoomDetail(99)).rejects.toBeInstanceOf(
      StoreRoomNotFoundError,
    )
  })

  it('rethrows every other error unchanged', async () => {
    const error = new Error('network')
    getMock.mockRejectedValueOnce(error)

    await expect(getStoreRoomDetail(1)).rejects.toBe(error)
  })
})
