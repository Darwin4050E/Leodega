import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'
import client from '../api/client'
import {
  deleteStoreRoom,
  extractApiMessage,
  getStoreRoomDetail,
  listStoreRooms,
  replaceStoreRoomPermit,
  resubmitStoreRoom,
  updateStoreRoom,
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
  default: { get: vi.fn(), delete: vi.fn(), put: vi.fn(), post: vi.fn() },
}))

const getMock = vi.mocked(client.get)
const deleteMock = vi.mocked(client.delete)
const putMock = vi.mocked(client.put)
const postMock = vi.mocked(client.post)

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

describe('deleteStoreRoom', () => {
  beforeEach(() => deleteMock.mockReset())

  it('calls DELETE /storeRooms/{id}', async () => {
    deleteMock.mockResolvedValueOnce({ data: { status: 200 } })
    await deleteStoreRoom(4)
    expect(deleteMock).toHaveBeenCalledWith('/storeRooms/4')
  })

  it('treats a 404 as already deleted', async () => {
    deleteMock.mockRejectedValueOnce(
      new AxiosError('nf', '404', undefined, undefined, { status: 404 } as never),
    )
    await expect(deleteStoreRoom(4)).resolves.toBeUndefined()
  })

  it('rethrows every other error', async () => {
    const conflict = new AxiosError('c', '409', undefined, undefined, {
      status: 409,
    } as never)
    deleteMock.mockRejectedValueOnce(conflict)
    await expect(deleteStoreRoom(4)).rejects.toBe(conflict)
  })
})

describe('extractApiMessage', () => {
  it('returns the backend message of an axios error', () => {
    const error = new AxiosError('c', '409', undefined, undefined, {
      status: 409,
      data: { message: 'Tiene reservas' },
    } as never)
    expect(extractApiMessage(error)).toBe('Tiene reservas')
  })

  it('returns null when there is no message', () => {
    expect(extractApiMessage(new Error('x'))).toBeNull()
    expect(
      extractApiMessage(
        new AxiosError('c', '500', undefined, undefined, { status: 500, data: {} } as never),
      ),
    ).toBeNull()
  })
})

describe('updateStoreRoom', () => {
  beforeEach(() => putMock.mockReset())

  it('PUTs the payload to /storeRooms/{id} and returns the body', async () => {
    putMock.mockResolvedValueOnce({
      data: { message: 'ok', status: 200, requires_review: true },
    })
    const result = await updateStoreRoom(4, { title: 'Nueva', price: 20 })
    expect(putMock).toHaveBeenCalledWith('/storeRooms/4', { title: 'Nueva', price: 20 })
    expect(result.requires_review).toBe(true)
  })
})

describe('replaceStoreRoomPermit', () => {
  beforeEach(() => postMock.mockReset())

  it('POSTs the PDF as firefighter_permit multipart', async () => {
    postMock.mockResolvedValueOnce({ data: {} })
    const file = new File(['%PDF'], 'permiso.pdf', { type: 'application/pdf' })
    await replaceStoreRoomPermit(4, file)

    const [url, form, config] = postMock.mock.calls[0]
    expect(url).toBe('/store-rooms/4/permit')
    expect((form as FormData).get('firefighter_permit')).toBe(file)
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } })
  })
})

describe('resubmitStoreRoom', () => {
  beforeEach(() => postMock.mockReset())

  it('POSTs an empty body to /storeRooms/{id}/resubmit', async () => {
    postMock.mockResolvedValueOnce({ data: {} })
    await resubmitStoreRoom(4)
    expect(postMock).toHaveBeenCalledWith('/storeRooms/4/resubmit')
  })
})
