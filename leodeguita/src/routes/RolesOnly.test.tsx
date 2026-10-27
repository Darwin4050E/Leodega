import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/session'
import RolesOnly from './RolesOnly'

const USER = { id: 7, name: 'Ana', lastname: 'Perez', email: 'ana@example.com' }

function renderAt(entry: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<div>Inicio</div>} />
          <Route element={<RolesOnly roles={['tenant', 'landlord']} />}>
            <Route path="/perfil" element={<div>Perfil abierto</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RolesOnly', () => {
  beforeEach(() => localStorage.clear())

  it.each(['tenant', 'landlord'] as const)('renders the nested route for a %s', (role) => {
    writeSession('tok', { ...USER, role })
    renderAt('/perfil')

    expect(screen.getByText('Perfil abierto')).toBeInTheDocument()
  })

  it('redirects any other role to /', () => {
    writeSession('tok', { ...USER, role: 'admin' })
    renderAt('/perfil')

    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Perfil abierto')).not.toBeInTheDocument()
  })
})
