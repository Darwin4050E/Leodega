import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from '../api/client'
import { listTenantReservations, type TenantReservation } from './reservations'

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))

const getMock = vi.mocked(client.get)

describe('listTenantReservations', () => {
  beforeEach(() => getMock.mockReset())

  it('returns the payload from GET /tenant/reservations', async () => {
    const rows = [{ id: 1 }] as TenantReservation[]
    getMock.mockResolvedValueOnce({ data: rows })

    const result = await listTenantReservations()

    expect(client.get).toHaveBeenCalledWith('/tenant/reservations')
    expect(result).toEqual(rows)
  })

  it('lets a failure reach the caller', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'))

    await expect(listTenantReservations()).rejects.toThrow('boom')
  })
})
