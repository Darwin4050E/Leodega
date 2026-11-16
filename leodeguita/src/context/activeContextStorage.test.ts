import { describe, it, expect, vi } from 'vitest'
import { writeSession } from '../auth/session'
import type { AuthUser } from '../auth/authContextBase'
import {
  ORGANIZATION_FORBIDDEN_MESSAGE,
  ORGANIZATION_HEADER,
  activeContextKey,
  clearStoredActiveContext,
  clearStoredOrganizationId,
  forcePersonalContext,
  parseOrganizationId,
  readRequestOrganizationId,
  readStoredOrganizationId,
  registerForcedPersonalHandler,
  writeStoredOrganizationId,
} from './activeContextStorage'

function sessionUser(id: number, role: AuthUser['role']): AuthUser {
  return { id, name: 'Ana', lastname: 'Perez', email: 'ana@example.com', role }
}

const TENANT = sessionUser(7, 'tenant')

describe('constants and key', () => {
  it('exposes the header name and the exact forbidden message', () => {
    expect(ORGANIZATION_HEADER).toBe('X-Organization-Id')
    expect(ORGANIZATION_FORBIDDEN_MESSAGE).toBe('No perteneces a la organización seleccionada')
  })

  it('builds a per-user key', () => {
    expect(activeContextKey(7)).toBe('leodeguita_active_context:7')
    expect(activeContextKey(8)).toBe('leodeguita_active_context:8')
  })
})

describe('parseOrganizationId', () => {
  it.each([
    ['12', 12],
    ['1', 1],
  ])('parses the canonical value %s', (raw, expected) => {
    expect(parseOrganizationId(raw)).toBe(expected)
  })

  it.each(['', '0', '007', '-3', '1.5', 'abc', '99999999999999999999', ' 12'])(
    'reads %j as absent',
    (raw) => {
      expect(parseOrganizationId(raw)).toBeNull()
    },
  )

  it('reads null as absent', () => {
    expect(parseOrganizationId(null)).toBeNull()
  })
})

describe('stored organization id', () => {
  it('writes the canonical string under the user key', () => {
    writeStoredOrganizationId(7, 12)

    expect(localStorage.getItem('leodeguita_active_context:7')).toBe('12')
  })

  it('reads the stored id back', () => {
    localStorage.setItem('leodeguita_active_context:7', '12')

    expect(readStoredOrganizationId(7)).toBe(12)
  })

  it('reads absent when the key does not exist', () => {
    expect(readStoredOrganizationId(7)).toBeNull()
  })

  it.each(['', '0', '007', '-3', '1.5', 'abc', '99999999999999999999'])(
    'reads the stored garbage %j as absent',
    (raw) => {
      localStorage.setItem('leodeguita_active_context:7', raw)

      expect(readStoredOrganizationId(7)).toBeNull()
    },
  )

  it('never returns another user value on read', () => {
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)

    expect(readStoredOrganizationId(7)).toBe(12)
    expect(readStoredOrganizationId(8)).toBe(30)
  })

  it('removes only the requested user key', () => {
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)

    clearStoredOrganizationId(7)

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(readStoredOrganizationId(8)).toBe(30)
  })
})

describe('readRequestOrganizationId', () => {
  it('returns the stored id for a tenant with a token', () => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)

    expect(readRequestOrganizationId()).toBe(12)
  })

  it('reads the key again on every call', () => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    expect(readRequestOrganizationId()).toBe(12)

    writeStoredOrganizationId(7, 15)

    expect(readRequestOrganizationId()).toBe(15)
  })

  it('returns null for a tenant without a stored id', () => {
    writeSession('tok-1', TENANT)

    expect(readRequestOrganizationId()).toBeNull()
  })

  it('returns null for a landlord with a stale key', () => {
    writeSession('tok-1', sessionUser(7, 'landlord'))
    writeStoredOrganizationId(7, 12)

    expect(readRequestOrganizationId()).toBeNull()
  })

  it('returns null for an admin with a key', () => {
    writeSession('tok-1', sessionUser(7, 'admin'))
    writeStoredOrganizationId(7, 12)

    expect(readRequestOrganizationId()).toBeNull()
  })

  it('returns null without a token', () => {
    localStorage.setItem('leodeguita_user', JSON.stringify(TENANT))
    writeStoredOrganizationId(7, 12)

    expect(readRequestOrganizationId()).toBeNull()
  })

  it('returns null for an invalid stored value', () => {
    writeSession('tok-1', TENANT)
    localStorage.setItem('leodeguita_active_context:7', '0')

    expect(readRequestOrganizationId()).toBeNull()
  })

  it.each([
    ['unparsable JSON', '{not json'],
    ['a non-object', '"tenant"'],
    ['a missing id', JSON.stringify({ role: 'tenant' })],
    ['a string id', JSON.stringify({ id: '7', role: 'tenant' })],
    ['a missing role', JSON.stringify({ id: 7 })],
    ['a numeric role', JSON.stringify({ id: 7, role: 1 })],
  ])('returns null without throwing for a user with %s', (_label, rawUser) => {
    localStorage.setItem('leodeguita_token', 'tok-1')
    localStorage.setItem('leodeguita_user', rawUser)
    localStorage.setItem('leodeguita_active_context:7', '12')

    expect(readRequestOrganizationId()).toBeNull()
  })
})

describe('clearStoredActiveContext', () => {
  it('removes only the session user key', () => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)

    clearStoredActiveContext()

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(readStoredOrganizationId(8)).toBe(30)
  })

  it('does not throw and removes nothing when the user is unreadable', () => {
    localStorage.setItem('leodeguita_user', '{not json')
    writeStoredOrganizationId(7, 12)

    expect(() => clearStoredActiveContext()).not.toThrow()
    expect(readStoredOrganizationId(7)).toBe(12)
  })
})

describe('forcePersonalContext', () => {
  it('removes the session user key and notifies the handler once', () => {
    const handler = vi.fn<() => void>()
    const unregister = registerForcedPersonalHandler(handler)
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)
    writeStoredOrganizationId(8, 30)

    forcePersonalContext()

    expect(readStoredOrganizationId(7)).toBeNull()
    expect(readStoredOrganizationId(8)).toBe(30)
    expect(handler).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('is idempotent when called twice', () => {
    const handler = vi.fn<() => void>()
    const unregister = registerForcedPersonalHandler(handler)
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)

    expect(() => {
      forcePersonalContext()
      forcePersonalContext()
    }).not.toThrow()

    expect(readStoredOrganizationId(7)).toBeNull()
    unregister()
  })

  it('works without a registered handler', () => {
    writeSession('tok-1', TENANT)
    writeStoredOrganizationId(7, 12)

    expect(() => forcePersonalContext()).not.toThrow()
    expect(readStoredOrganizationId(7)).toBeNull()
  })

  it('stops notifying after unregister', () => {
    const handler = vi.fn<() => void>()
    const unregister = registerForcedPersonalHandler(handler)
    unregister()

    forcePersonalContext()

    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps the newest handler when an older one unregisters late', () => {
    const first = vi.fn<() => void>()
    const second = vi.fn<() => void>()
    const unregisterFirst = registerForcedPersonalHandler(first)
    const unregisterSecond = registerForcedPersonalHandler(second)

    unregisterFirst()
    forcePersonalContext()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    unregisterSecond()
  })
})
