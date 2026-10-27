import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/session'
import RoleTabBar from './RoleTabBar'

const USER = { id: 7, name: 'Ana', lastname: 'Perez', email: 'ana@example.com' }

function renderBar(path = '/bodegas') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<RoleTabBar />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RoleTabBar', () => {
  beforeEach(() => writeSession('tok', { ...USER, role: 'tenant' }))

  it('offers exactly Explorar, Reservas and Perfil', () => {
    renderBar()

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(nav.querySelectorAll('a')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Explorar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reservas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
  })

  it.each([
    ['/bodegas', 'Explorar'],
    ['/bodegas/5', 'Explorar'],
    ['/reservas', 'Reservas'],
    ['/perfil', 'Perfil'],
  ])('marks the tab of %s as current', (path, label) => {
    renderBar(path)

    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((l) => l.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('navigates when a tab is tapped', async () => {
    renderBar('/bodegas')

    await userEvent.setup().click(screen.getByRole('link', { name: 'Perfil' }))

    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders nothing for an admin', () => {
    writeSession('tok', { ...USER, role: 'admin' })
    renderBar()

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  describe('as a landlord', () => {
    beforeEach(() => writeSession('tok', { ...USER, role: 'landlord' }))

    it('offers exactly Mis bodegas, Reservas and Perfil', () => {
      renderBar('/mis-bodegas')

      const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
      expect(nav.querySelectorAll('a')).toHaveLength(3)
      expect(screen.getByRole('link', { name: 'Mis bodegas' })).toHaveAttribute('href', '/mis-bodegas')
      expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('href', '/reservas')
      expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/perfil')
      expect(screen.queryByRole('link', { name: 'Explorar' })).not.toBeInTheDocument()
    })

    it.each([
      ['/mis-bodegas', 'Mis bodegas'],
      ['/reservas', 'Reservas'],
      ['/perfil', 'Perfil'],
    ])('marks the tab of %s as current', (path, label) => {
      renderBar(path)

      expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    })
  })
})
