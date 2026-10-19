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
import { readStoredOrganizationId, writeStoredOrganizationId } from '../context/activeContextStorage'
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

const TENANT = { ...USER, id: 7, role: 'tenant' as const }
const FORBIDDEN_BODY = { message: 'No perteneces a la organización seleccionada' }

describe('client organization header', () => {
  beforeEach(() => {
    writeSession('tok-1', TENANT)
  })

  it('sends the stored id and the unchanged Authorization for a tenant', async () => {
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.get('X-Organization-Id')).toBe('12')
    expect(sent[0].headers.Authorization).toBe('Bearer tok-1')
  })

  it('omits the header for a tenant without a stored id', async () => {
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
    expect(sent[0].headers.Authorization).toBe('Bearer tok-1')
  })

  it('omits the header for a landlord with a stale key', async () => {
    writeSession('tok-1', { ...USER, id: 7 })
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
  })

  it('omits the header for an admin with a key', async () => {
    writeSession('tok-1', { ...USER, id: 7, role: 'admin' })
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
  })

  it('sends neither header on a request without a token', async () => {
    localStorage.removeItem('leodeguita_token')
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.post('/login', {})

    expect(sent[0].headers.has('Authorization')).toBe(false)
    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
  })

  it('sends the header on every authenticated route, including /organizations', async () => {
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.get('/organizations')
    await client.get('/storeRooms')

    expect(sent.map((config) => config.headers.get('X-Organization-Id'))).toEqual(['12', '12'])
  })

  it('reads the key at request time', async () => {
    writeStoredOrganizationId(7, 12)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')
    writeStoredOrganizationId(7, 15)
    await client.get('/storeRooms')

    expect(sent.map((config) => config.headers.get('X-Organization-Id'))).toEqual(['12', '15'])
  })

  it('omits the header without throwing when the stored user is invalid', async () => {
    localStorage.setItem('leodeguita_user', '{not json')
    localStorage.setItem('leodeguita_active_context:7', '12')
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
  })

  it.each(['0', 'abc'])('omits the header for the invalid key %j', async (raw) => {
    localStorage.setItem('leodeguita_active_context:7', raw)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
  })
})

describe('client organization 403 fallback', () => {
  beforeEach(() => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
  })

  it('removes the key on the exact message and still rejects with the 403', async () => {
    replyWith(() => ({ status: 403, data: FORBIDDEN_BODY }))

    await expect(client.post('/reservations', {})).rejects.toMatchObject({
      response: { status: 403 },
    })

    expect(sent[0].headers.get('X-Organization-Id')).toBe('12')
    expect(readStoredOrganizationId(7)).toBeNull()
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the key when the message is different', async () => {
    replyWith(() => ({ status: 403, data: { message: 'No autorizado' } }))

    await expect(client.post('/reservations', {})).rejects.toBeInstanceOf(AxiosError)

    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('keeps a key written after a request that sent no header', async () => {
    localStorage.removeItem('leodeguita_active_context:7')
    replyWith(() => {
      writeStoredOrganizationId(7, 12)
      return { status: 403, data: FORBIDDEN_BODY }
    })

    await expect(client.get('/tenant/reservations')).rejects.toBeInstanceOf(AxiosError)

    expect(sent[0].headers.has('X-Organization-Id')).toBe(false)
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('keeps a newer choice when a late 403 belongs to a superseded one', async () => {
    replyWith(() => {
      writeStoredOrganizationId(7, 15)
      return { status: 403, data: FORBIDDEN_BODY }
    })

    await expect(client.post('/reservations', {})).rejects.toBeInstanceOf(AxiosError)

    expect(sent[0].headers.get('X-Organization-Id')).toBe('12')
    expect(readStoredOrganizationId(7)).toBe(15)
  })

  it.each([404, 422, 500])('keeps the key on a %i with the exact message', async (status) => {
    replyWith(() => ({ status, data: FORBIDDEN_BODY }))

    await expect(client.get('/storeRooms')).rejects.toBeInstanceOf(AxiosError)

    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('only runs session expiry on a 401 with the exact message', async () => {
    replyWith(() => ({ status: 401, data: FORBIDDEN_BODY }))

    await expect(client.get('/storeRooms')).rejects.toBeInstanceOf(AxiosError)

    expect(readToken()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('leodeguita_active_context:7')).toBe('12')
  })

  it("leaves another user's key untouched", async () => {
    writeStoredOrganizationId(8, 30)
    replyWith(() => ({ status: 403, data: FORBIDDEN_BODY }))

    await expect(client.post('/reservations', {})).rejects.toBeInstanceOf(AxiosError)

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(readStoredOrganizationId(8)).toBe(30)
  })

  it('is idempotent when two concurrent requests both get the 403', async () => {
    replyWith(() => ({ status: 403, data: FORBIDDEN_BODY }))

    const results = await Promise.allSettled([
      client.post('/reservations', {}),
      client.get('/tenant/reservations'),
    ])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(sent).toHaveLength(2)
    expect(readStoredOrganizationId(7)).toBeNull()
  })

  it('sends no header on the request after the fallback ran', async () => {
    replyWith(() => ({ status: 403, data: FORBIDDEN_BODY }))
    await expect(client.post('/reservations', {})).rejects.toBeInstanceOf(AxiosError)
    replyWith(() => ({ status: 200 }))

    await client.get('/storeRooms')

    expect(sent[1].headers.has('X-Organization-Id')).toBe(false)
  })
})
