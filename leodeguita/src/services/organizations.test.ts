import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'
import client from '../api/client'
import { listOrganizations, type Organization } from './organizations'

vi.mock('../api/client', () => ({
  default: { get: vi.fn() },
}))

const getMock = vi.mocked(client.get)

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 2,
    name: 'Importadora Andina S.A.',
    ruc: '1790012345001',
    email: 'info@andina.example.com',
    logo: 'https://cdn.example.com/andina.png',
    status: 'active',
    role: 'admin',
    ...overrides,
  }
}

beforeEach(() => {
  getMock.mockReset()
})

describe('listOrganizations', () => {
  it('sends exactly one GET /organizations through the shared client', async () => {
    getMock.mockResolvedValue({ data: [] })

    await listOrganizations()

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith('/organizations')
  })

  it('returns the array in API order with every field intact', async () => {
    const list = [
      organization({ id: 2 }),
      organization({ id: 5, name: 'Logistica Sur', logo: null, status: 'suspended', role: 'member' }),
    ]
    getMock.mockResolvedValue({ data: list })

    const result = await listOrganizations()

    expect(result).toEqual(list)
    expect(result.map((item) => item.id)).toEqual([2, 5])
  })

  it('returns an empty array for an empty list', async () => {
    getMock.mockResolvedValue({ data: [] })

    expect(await listOrganizations()).toEqual([])
  })

  it.each([
    ['an object', { data: [] }],
    ['null', null],
    ['a string', 'not a list'],
  ])('throws instead of returning an empty list when the body is %s', async (_label, body) => {
    getMock.mockResolvedValue({ data: body })

    await expect(listOrganizations()).rejects.toThrow()
  })

  it.each([401, 403, 500])('rejects with the original error on a %i', async (status) => {
    const failure = new AxiosError('failed', String(status))
    getMock.mockRejectedValue(failure)

    await expect(listOrganizations()).rejects.toBe(failure)
  })

  it('rejects with the original error on a network failure', async () => {
    const failure = new Error('Network Error')
    getMock.mockRejectedValue(failure)

    await expect(listOrganizations()).rejects.toBe(failure)
  })
})
