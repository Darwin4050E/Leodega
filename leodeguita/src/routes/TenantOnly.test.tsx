import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/session'
import { ActiveContextProvider } from '../context/ActiveContextProvider'
import { listOrganizations } from '../services/organizations'
import TenantOnly from './TenantOnly'

vi.mock('../services/organizations', () => ({
  listOrganizations: vi.fn(),
}))

const listMock = vi.mocked(listOrganizations)

const USER = {
  id: 7,
  name: 'Ana',
  lastname: 'Perez',
  email: 'ana@example.com',
}

function renderAt(entry: string) {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/" element={<div>Inicio</div>} />
            <Route element={<TenantOnly />}>
              <Route path="/empresa" element={<div>Selector</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('TenantOnly', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([])
  })

  it('redirects a landlord to / without requesting organizations', () => {
    writeSession('tok', { ...USER, role: 'landlord' })
    renderAt('/empresa')

    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(listMock).not.toHaveBeenCalled()
  })

  it('redirects an admin to /', () => {
    writeSession('tok', { ...USER, role: 'admin' })
    renderAt('/empresa')

    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Selector')).not.toBeInTheDocument()
  })

  it('renders the nested route for a tenant', () => {
    writeSession('tok', { ...USER, role: 'tenant' })
    renderAt('/empresa')

    expect(screen.getByText('Selector')).toBeInTheDocument()
  })
})
