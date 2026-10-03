import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  SESSION_EXPIRED_MESSAGE,
  SESSION_EXPIRED_REASON,
  handleUnauthorized,
  registerUnauthorizedHandler,
} from './sessionExpiry'
import { readToken, readUser, writeSession } from './session'

const USER = {
  id: 1,
  name: 'Ana',
  lastname: 'Pérez',
  email: 'ana@example.com',
  role: 'landlord' as const,
}

let unregister: (() => void) | undefined

function register() {
  const handler = vi.fn()
  unregister = registerUnauthorizedHandler(handler)
  return handler
}

afterEach(() => {
  unregister?.()
  unregister = undefined
})

describe('sessionExpiry constants', () => {
  it('exposes the router-state reason and the Spanish notice', () => {
    expect(SESSION_EXPIRED_REASON).toBe('session-expired')
    expect(SESSION_EXPIRED_MESSAGE).toBe('Tu sesión terminó, inicia sesión de nuevo')
  })
})

describe('handleUnauthorized', () => {
  it('clears the stored session and calls the handler once when the sent token is the current one', () => {
    writeSession('tok-1', USER)
    const handler = register()

    handleUnauthorized('Bearer tok-1')

    expect(readToken()).toBeNull()
    expect(readUser()).toBeNull()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('clears storage before the handler runs', () => {
    writeSession('tok-1', USER)
    let tokenSeenByHandler: string | null | undefined
    unregister = registerUnauthorizedHandler(() => {
      tokenSeenByHandler = readToken()
    })

    handleUnauthorized('Bearer tok-1')

    expect(tokenSeenByHandler).toBeNull()
  })

  it('fires once for three concurrent 401s carrying the same token', () => {
    writeSession('tok-1', USER)
    const handler = register()

    handleUnauthorized('Bearer tok-1')
    handleUnauthorized('Bearer tok-1')
    handleUnauthorized('Bearer tok-1')

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when there is no stored token', () => {
    const handler = register()

    handleUnauthorized('Bearer tok-1')
    handleUnauthorized(undefined)

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores a stale 401 whose request was sent with a previous token', () => {
    writeSession('tok-2', USER)
    const handler = register()

    handleUnauthorized('Bearer tok-1')

    expect(readToken()).toBe('tok-2')
    expect(readUser()).toEqual(USER)
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores a 401 whose request carried no Authorization header', () => {
    writeSession('tok-1', USER)
    const handler = register()

    handleUnauthorized(undefined)

    expect(readToken()).toBe('tok-1')
    expect(handler).not.toHaveBeenCalled()
  })

  it('still clears storage when no handler is registered', () => {
    writeSession('tok-1', USER)

    handleUnauthorized('Bearer tok-1')

    expect(readToken()).toBeNull()
  })

  it('stops calling the handler after it is unregistered', () => {
    writeSession('tok-1', USER)
    const handler = register()

    unregister?.()
    handleUnauthorized('Bearer tok-1')

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not drop a newer handler when an older one unregisters late', () => {
    writeSession('tok-1', USER)
    const oldHandler = vi.fn()
    const newHandler = vi.fn()
    const unregisterOld = registerUnauthorizedHandler(oldHandler)
    unregister = registerUnauthorizedHandler(newHandler)

    unregisterOld()
    handleUnauthorized('Bearer tok-1')

    expect(oldHandler).not.toHaveBeenCalled()
    expect(newHandler).toHaveBeenCalledTimes(1)
  })
})
