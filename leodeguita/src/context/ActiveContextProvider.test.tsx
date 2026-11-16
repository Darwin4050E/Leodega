import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import client from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { useAuth } from '../auth/useAuth'
import { writeSession } from '../auth/session'
import { ActiveContextProvider } from './ActiveContextProvider'
import { useActiveContext } from './useActiveContext'
import { ORGANIZATIONS_STATUS } from './activeContextBase'
import {
  forcePersonalContext,
  ORGANIZATION_FORBIDDEN_MESSAGE,
  ORGANIZATION_HEADER,
  readStoredOrganizationId,
  writeStoredOrganizationId,
} from './activeContextStorage'
import { listOrganizations, type Organization } from '../services/organizations'

vi.mock('../services/organizations', () => ({
  listOrganizations: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)

const TENANT = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
  role: 'tenant' as const,
}
const OTHER_TENANT = { ...TENANT, id: 8, name: 'Beto', email: 'beto@example.com' }
const LANDLORD = { ...TENANT, id: 1, role: 'landlord' as const }

function organization(id: number, name = `Org ${id}`): Organization {
  return { id, name, ruc: '1', email: 'o@example.com', logo: null, status: 'active', role: 'member' }
}

const ORG_12 = organization(12)
const ORG_15 = organization(15)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Probe() {
  const ctx = useActiveContext()
  const { setSession, clear } = useAuth()
  return (
    <div>
      <output data-testid="status">{ctx.status}</output>
      <output data-testid="enabled">{String(ctx.enabled)}</output>
      <output data-testid="orgs">{ctx.organizations.map((o) => o.id).join(',')}</output>
      <output data-testid="stored">{String(ctx.storedOrganizationId)}</output>
      <output data-testid="active">{ctx.activeOrganization?.name ?? 'none'}</output>
      <button onClick={() => ctx.selectOrganization(12)}>select 12</button>
      <button onClick={() => ctx.selectOrganization(15)}>select 15</button>
      <button onClick={ctx.selectPersonal}>select personal</button>
      <button onClick={ctx.reloadOrganizations}>reload</button>
      <button onClick={() => setSession('tok-b', OTHER_TENANT)}>login b</button>
      <button onClick={() => setSession('tok-a', TENANT)}>login a</button>
      <button onClick={clear}>logout</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <Probe />
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

function text(testId: string) {
  return screen.getByTestId(testId).textContent
}

const originalAdapter = client.defaults.adapter
let sent: InternalAxiosRequestConfig[]

function replyWith(status: number, data: unknown = {}) {
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status < 300) return response
    throw new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, config, null, response)
  }
  client.defaults.adapter = adapter
}

async function sendRequest() {
  await client.get('/storeRooms').catch(() => undefined)
  return sent[sent.length - 1]?.headers.get(ORGANIZATION_HEADER) ?? null
}

beforeEach(() => {
  listMock.mockReset()
  sent = []
  replyWith(200)
})

afterEach(() => {
  client.defaults.adapter = originalAdapter
})

describe('useActiveContext', () => {
  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/ActiveContextProvider/)
    spy.mockRestore()
  })
})

describe('ActiveContextProvider list lifecycle', () => {
  it('stays idle and sends no request for a landlord', () => {
    writeSession('tok-1', LANDLORD)
    renderProvider()

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.IDLE)
    expect(text('enabled')).toBe('false')
    expect(listMock).not.toHaveBeenCalled()
  })

  it('stays idle and sends no request without a session', () => {
    renderProvider()

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.IDLE)
    expect(text('enabled')).toBe('false')
    expect(listMock).not.toHaveBeenCalled()
  })

  it('goes loading and then ready with the list for a tenant', async () => {
    const pending = deferred<Organization[]>()
    listMock.mockReturnValue(pending.promise)
    writeSession('tok-1', TENANT)
    renderProvider()

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.LOADING)
    expect(text('enabled')).toBe('true')
    expect(listMock).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve([ORG_12, ORG_15]))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY)
    expect(text('orgs')).toBe('12,15')
  })

  it('goes to error with an empty list and keeps the stored id when the fetch fails', async () => {
    listMock.mockRejectedValue(new Error('network'))
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()

    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))
    expect(text('orgs')).toBe('')
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('reloads from error through loading to ready with a new request', async () => {
    const user = userEvent.setup()
    listMock.mockRejectedValueOnce(new Error('network'))
    writeSession('tok-1', TENANT)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))

    const pending = deferred<Organization[]>()
    listMock.mockReturnValue(pending.promise)
    await user.click(screen.getByRole('button', { name: 'reload' }))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.LOADING)
    expect(listMock).toHaveBeenCalledTimes(2)

    await act(async () => pending.resolve([ORG_12]))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY)
    expect(text('orgs')).toBe('12')
  })

  it('exposes the stored organization before the response with no resolved organization', () => {
    listMock.mockReturnValue(deferred<Organization[]>().promise)
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()

    expect(text('stored')).toBe('12')
    expect(text('active')).toBe('none')
  })

  it('does not send another request on a plain re-render', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([ORG_12])
    writeSession('tok-1', TENANT)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY))

    await user.click(screen.getByRole('button', { name: 'select personal' }))

    expect(listMock).toHaveBeenCalledTimes(1)
  })
})

describe('ActiveContextProvider user changes', () => {
  it('ignores a late response of the previous tenant and derives from the next one', async () => {
    const user = userEvent.setup()
    const first = deferred<Organization[]>()
    const second = deferred<Organization[]>()
    listMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    writeSession('tok-a', TENANT)
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'logout' }))
    await user.click(screen.getByRole('button', { name: 'login b' }))

    expect(text('stored')).toBe('30')
    expect(listMock).toHaveBeenCalledTimes(2)

    await act(async () => first.resolve([ORG_12]))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.LOADING)
    expect(text('orgs')).toBe('')

    await act(async () => second.resolve([organization(30)]))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY)
    expect(text('orgs')).toBe('30')
    expect(text('active')).toBe('Org 30')
  })

  it('resets to personal and idle on logout', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([ORG_12])
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('active')).toBe('Org 12'))

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.IDLE)
    expect(text('stored')).toBe('null')
    expect(text('orgs')).toBe('')
  })

  it('keeps the key on session expiry and revalidates it against the fresh list on re-login', async () => {
    const user = userEvent.setup()
    const { handleUnauthorized } = await import('../auth/sessionExpiry')
    listMock.mockResolvedValueOnce([ORG_12])
    writeSession('tok-a', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('active')).toBe('Org 12'))

    act(() => handleUnauthorized('Bearer tok-a'))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.IDLE)
    expect(readStoredOrganizationId(7)).toBe(12)

    const fresh = deferred<Organization[]>()
    listMock.mockReturnValueOnce(fresh.promise)
    await user.click(screen.getByRole('button', { name: 'login a' }))

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.LOADING)
    expect(text('stored')).toBe('12')

    await act(async () => fresh.resolve([ORG_15]))

    expect(text('stored')).toBe('null')
    expect(readStoredOrganizationId(7)).toBeNull()
  })
})

describe('ActiveContextProvider stored id validation', () => {
  async function renderTenant(storedId: number | null, list: Organization[]) {
    listMock.mockResolvedValue(list)
    writeSession('tok-1', TENANT)
    if (storedId !== null) writeStoredOrganizationId(7, storedId)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY))
  }

  it('keeps a stored id that is in the list and resolves the organization', async () => {
    await renderTenant(12, [ORG_12, ORG_15])

    expect(text('stored')).toBe('12')
    expect(text('active')).toBe('Org 12')
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('removes a stored id that is not in the list and goes personal', async () => {
    await renderTenant(12, [ORG_15])

    expect(text('stored')).toBe('null')
    expect(text('active')).toBe('none')
    expect(readStoredOrganizationId(7)).toBeNull()
  })

  it('clears the stored id when the ready list is empty', async () => {
    await renderTenant(12, [])

    expect(text('stored')).toBe('null')
    expect(readStoredOrganizationId(7)).toBeNull()
  })

  it('keeps the key and the context while loading', () => {
    listMock.mockReturnValue(deferred<Organization[]>().promise)
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()

    expect(text('status')).toBe(ORGANIZATIONS_STATUS.LOADING)
    expect(text('stored')).toBe('12')
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('keeps the key on error and requests still carry the header', async () => {
    listMock.mockRejectedValue(new Error('network'))
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))

    expect(text('stored')).toBe('12')
    expect(await sendRequest()).toBe('12')
  })

  it('keeps the key on error when the body is not an array', async () => {
    listMock.mockRejectedValue(new Error('Unexpected organizations response'))
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))

    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('resolves the stored organization when a reload succeeds with it', async () => {
    const user = userEvent.setup()
    listMock.mockRejectedValueOnce(new Error('network'))
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))

    listMock.mockResolvedValue([ORG_12])
    await user.click(screen.getByRole('button', { name: 'reload' }))

    await waitFor(() => expect(text('active')).toBe('Org 12'))
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('removes the stored id when a reload succeeds without it', async () => {
    const user = userEvent.setup()
    listMock.mockRejectedValueOnce(new Error('network'))
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.ERROR))

    listMock.mockResolvedValue([ORG_15])
    await user.click(screen.getByRole('button', { name: 'reload' }))

    await waitFor(() => expect(text('stored')).toBe('null'))
    expect(readStoredOrganizationId(7)).toBeNull()
  })
})

describe('ActiveContextProvider selection', () => {
  async function renderReadyTenant(storedId: number | null = null) {
    listMock.mockResolvedValue([ORG_12, ORG_15])
    writeSession('tok-1', TENANT)
    if (storedId !== null) writeStoredOrganizationId(7, storedId)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY))
  }

  it('persists the selected organization and the next request carries it', async () => {
    const user = userEvent.setup()
    await renderReadyTenant()

    await user.click(screen.getByRole('button', { name: 'select 12' }))

    expect(readStoredOrganizationId(7)).toBe(12)
    expect(text('stored')).toBe('12')
    expect(text('active')).toBe('Org 12')
    expect(await sendRequest()).toBe('12')
  })

  it('removes the key on personal and the next request has no header', async () => {
    const user = userEvent.setup()
    await renderReadyTenant(12)

    await user.click(screen.getByRole('button', { name: 'select personal' }))

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(text('stored')).toBe('null')
    expect(await sendRequest()).toBeNull()
  })

  it('issues no request by itself', async () => {
    const user = userEvent.setup()
    await renderReadyTenant()
    sent.length = 0

    await user.click(screen.getByRole('button', { name: 'select 15' }))
    await user.click(screen.getByRole('button', { name: 'select personal' }))

    expect(sent).toHaveLength(0)
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('leaves state and key unchanged when the same id is selected again', async () => {
    const user = userEvent.setup()
    await renderReadyTenant(12)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    await user.click(screen.getByRole('button', { name: 'select 12' }))

    expect(setItem).not.toHaveBeenCalled()
    expect(text('stored')).toBe('12')
    expect(readStoredOrganizationId(7)).toBe(12)
    setItem.mockRestore()
  })

  it('is a no-op for a landlord', async () => {
    const user = userEvent.setup()
    writeSession('tok-1', LANDLORD)
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'select 12' }))
    await user.click(screen.getByRole('button', { name: 'select personal' }))

    expect(text('stored')).toBe('null')
    expect(localStorage.getItem('leodeguita_active_context:1')).toBeNull()
  })
})

describe('ActiveContextProvider forced personal context', () => {
  it('moves to personal when the organization 403 comes through the real client', async () => {
    listMock.mockResolvedValue([ORG_12])
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('active')).toBe('Org 12'))

    replyWith(403, { message: ORGANIZATION_FORBIDDEN_MESSAGE })
    await act(async () => {
      await client.get('/tenant/reservations').catch(() => undefined)
    })

    expect(text('stored')).toBe('null')
    expect(readStoredOrganizationId(7)).toBeNull()

    replyWith(200)
    expect(await sendRequest()).toBeNull()
  })

  it('moves to personal when the reset is triggered directly', async () => {
    listMock.mockResolvedValue([ORG_12])
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    renderProvider()
    await waitFor(() => expect(text('active')).toBe('Org 12'))

    act(() => forcePersonalContext())

    expect(text('stored')).toBe('null')
    expect(await sendRequest()).toBeNull()
  })
})

describe('ActiveContextProvider multi-tab sync', () => {
  function dispatchStorage(userId: number, newValue: string | null) {
    const key = `leodeguita_active_context:${userId}`
    if (newValue === null) localStorage.removeItem(key)
    else localStorage.setItem(key, newValue)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
    })
  }

  async function renderReadyTenant(storedId: number | null = null) {
    listMock.mockResolvedValue([ORG_12, ORG_15])
    writeSession('tok-1', TENANT)
    if (storedId !== null) writeStoredOrganizationId(7, storedId)
    renderProvider()
    await waitFor(() => expect(text('status')).toBe(ORGANIZATIONS_STATUS.READY))
  }

  it('follows another tab selecting an organization from the ready list', async () => {
    await renderReadyTenant()

    dispatchStorage(7, '12')

    expect(text('stored')).toBe('12')
    expect(text('active')).toBe('Org 12')
  })

  it('follows another tab going personal', async () => {
    await renderReadyTenant(12)

    dispatchStorage(7, null)

    expect(text('stored')).toBe('null')
  })

  it("ignores another user's key", async () => {
    await renderReadyTenant(12)

    dispatchStorage(8, '15')

    expect(text('stored')).toBe('12')
    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('removes an id that is not in the ready list and goes personal', async () => {
    await renderReadyTenant()

    dispatchStorage(7, '99')

    expect(text('stored')).toBe('null')
    expect(readStoredOrganizationId(7)).toBeNull()
  })
})
