import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import client from './client'
import { login, logout } from '../services/auth'
import { readToken, readUser, writeSession } from '../auth/session'
import { registerUnauthorizedHandler } from '../auth/sessionExpiry'

const USER = {
  id: 1,
  name: 'Ana',
  lastname: 'Pérez',
  email: 'ana@example.com',
  role: 'landlord' as const,
}

type Reply = { status: number; data?: unknown }

const originalAdapter = client.defaults.adapter
let sent: InternalAxiosRequestConfig[]
let unregister: () => void
let handler: Mock<() => void>

function replyWith(
  respond: (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>,
) {
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config)
    const { status, data = {} } = await respond(config)
    const response: AxiosResponse = {
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    }
    if (status >= 200 && status < 300) return response
    throw new AxiosError(
      `Request failed with status code ${status}`,
      status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      response,
    )
  }
  client.defaults.adapter = adapter
}

beforeEach(() => {
  sent = []
  handler = vi.fn<() => void>()
  unregister = registerUnauthorizedHandler(handler)
  writeSession('tok-1', USER)
})

afterEach(() => {
  unregister()
  client.defaults.adapter = originalAdapter
})

describe('client 401 interceptor', () => {
  it('clears the session and notifies once on a 401 from a GET', async () => {
    replyWith(() => ({ status: 401 }))

    await expect(client.get('/storeRooms')).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(sent[0].headers.Authorization).toBe('Bearer tok-1')
    expect(readToken()).toBeNull()
    expect(readUser()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does the same for a 401 from a mutation', async () => {
    replyWith(() => ({ status: 401 }))

    await expect(client.put('/storeRooms/5', { title: 'X' })).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(readToken()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('rejects with the original error instead of swallowing it', async () => {
    replyWith(() => ({ status: 401, data: { message: 'Unauthenticated.' } }))

    const error = await client.get('/storeRooms').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AxiosError)
    expect((error as AxiosError).response?.data).toEqual({ message: 'Unauthenticated.' })
  })

  it('handles three concurrent 401s once', async () => {
    replyWith(() => ({ status: 401 }))

    await Promise.allSettled([
      client.get('/storeRooms'),
      client.get('/storeRooms/1'),
      client.get('/storeRooms/2'),
    ])

    expect(sent).toHaveLength(3)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('handles the same way a blocked user whose revoked token now returns 401', async () => {
    replyWith(() => ({ status: 401, data: { message: 'Unauthenticated.' } }))

    await expect(client.get('/storeRooms/mine')).rejects.toBeInstanceOf(AxiosError)

    expect(readToken()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores a 401 for a request sent before a newer login replaced the token', async () => {
    replyWith(() => {
      writeSession('tok-2', USER)
      return { status: 401 }
    })

    await expect(client.get('/storeRooms')).rejects.toBeInstanceOf(AxiosError)

    expect(readToken()).toBe('tok-2')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does nothing on a 401 when there was no session', async () => {
    localStorage.clear()
    replyWith(() => ({ status: 401 }))

    await expect(client.get('/storeRooms')).rejects.toBeInstanceOf(AxiosError)

    expect(handler).not.toHaveBeenCalled()
  })

  it.each([403, 404, 422, 500])('does not treat a %i as session expiry', async (status) => {
    replyWith(() => ({ status }))

    await expect(client.get('/storeRooms')).rejects.toMatchObject({
      response: { status },
    })

    expect(readToken()).toBe('tok-1')
    expect(readUser()).toEqual(USER)
    expect(handler).not.toHaveBeenCalled()
  })

  it('passes a 2xx response through untouched', async () => {
    replyWith(() => ({ status: 200, data: { data: [] } }))

    const response = await client.get('/storeRooms')

    expect(response.data).toEqual({ data: [] })
    expect(readToken()).toBe('tok-1')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('client 401 interceptor exclusions', () => {
  it.each(['/login', '/login/', '/login?next=1', '/logout', '/logout/'])(
    'keeps the session on a 401 from %s',
    async (url) => {
      replyWith(() => ({ status: 401 }))

      await expect(client.post(url, {})).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(readToken()).toBe('tok-1')
      expect(handler).not.toHaveBeenCalled()
    },
  )

  it.each(['/loginx', '/users/login', '/logout-all'])(
    'does not exclude the lookalike %s',
    async (url) => {
      replyWith(() => ({ status: 401 }))

      await expect(client.post(url, {})).rejects.toBeInstanceOf(AxiosError)

      expect(readToken()).toBeNull()
      expect(handler).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps the session when the real login() gets a 401 for wrong credentials', async () => {
    replyWith(() => ({ status: 401, data: { message: 'Invalid credentials' } }))

    await expect(login('ana@example.com', 'wrong')).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(sent[0].url).toBe('/login')
    expect(readToken()).toBe('tok-1')
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the session when the real logout() gets a 401', async () => {
    replyWith(() => ({ status: 401 }))

    await expect(logout()).rejects.toMatchObject({ response: { status: 401 } })

    expect(sent[0].url).toBe('/logout')
    expect(readToken()).toBe('tok-1')
    expect(handler).not.toHaveBeenCalled()
  })
})
