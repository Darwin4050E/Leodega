import { describe, it, expect } from 'vitest'
import { safeReturnPath } from './returnPath'

describe('safeReturnPath', () => {
  it.each([
    '/',
    '/mis-bodegas',
    '/bodegas/7?x=1#a',
    '/%5c',
    '/loginx',
    '/a/login',
  ])('accepts the app-internal path %s unchanged', (value) => {
    expect(safeReturnPath(value)).toBe(value)
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute https URL', 'https://evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['slash plus backslash', '/\\evil.com'],
    ['leading backslashes', '\\\\evil.com'],
    ['backslash inside the path', '/a\\b'],
    ['encoded protocol-relative (not a leading slash)', '%2F%2Fevil.com'],
    ['newline', '/a\nb'],
    ['tab', '/a\tb'],
    ['NUL', '/a\u0000b'],
    ['DEL', '/a\u007fb'],
    ['empty string', ''],
    ['relative path without a leading slash', 'bodegas'],
    ['login itself', '/login'],
    ['login with a query', '/login?x=1'],
    ['login with a trailing slash', '/login/'],
    ['login with a hash', '/login#x'],
  ])('rejects %s', (_label, value) => {
    expect(safeReturnPath(value)).toBeNull()
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['object', { from: '/mis-bodegas' }],
    ['array', ['/mis-bodegas']],
    ['boolean', true],
  ])('rejects the non-string value %s', (_label, value) => {
    expect(safeReturnPath(value)).toBeNull()
  })
})
