import { describe, it, expect } from 'vitest'
import { organizationInitials, roleLabel } from './model'

describe('organizationInitials', () => {
  it('uses the first letter of the first two words, uppercased', () => {
    expect(organizationInitials('Importadora Andina S.A.')).toBe('IA')
    expect(organizationInitials('beta gamma')).toBe('BG')
  })

  it('uses the first letter for a one-word name', () => {
    expect(organizationInitials('Leodega')).toBe('L')
    expect(organizationInitials('acme')).toBe('A')
  })

  it('falls back to OR for a blank or empty name', () => {
    expect(organizationInitials('')).toBe('OR')
    expect(organizationInitials('   ')).toBe('OR')
  })

  it('ignores extra spaces and never returns more than two letters', () => {
    expect(organizationInitials('  uno   dos  tres ')).toBe('UD')
  })
})

describe('roleLabel', () => {
  it('maps admin to Administrador', () => {
    expect(roleLabel('admin')).toBe('Administrador')
  })

  it('maps member to Miembro', () => {
    expect(roleLabel('member')).toBe('Miembro')
  })

  it('falls back to Miembro for an unexpected value', () => {
    expect(roleLabel('owner' as never)).toBe('Miembro')
  })
})
