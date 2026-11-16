import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { writeSession } from '../auth/session'
import { ActiveContextProvider } from '../context/ActiveContextProvider'
import { activeContextKey } from '../context/activeContextStorage'
import { listOrganizations, type Organization } from '../services/organizations'
import SelectCompanyScreen from '../screens/SelectCompany/SelectCompanyScreen'
import ActiveContextEntry from './ActiveContextEntry'

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

function organization(id: number, name: string): Organization {
  return {
    id,
    name,
    ruc: '0999999999001',
    email: `org${id}@example.com`,
    logo: null,
    status: 'active',
    role: 'member',
  }
}

const ORG_A = organization(12, 'Importadora Andina')
const ORG_B = organization(15, 'Bodegas del Sur')
const ORG_C = organization(20, 'Cargas del Norte')

function renderEntry() {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<ActiveContextEntry />} />
            <Route path="/empresa" element={<p>Selector abierto</p>} />
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('ActiveContextEntry', () => {
  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', TENANT)
  })

  it('shows the personal label and the change action once the list is ready', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderEntry()

    expect(await screen.findByText('Operando como Modo personal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cambiar/i })).toHaveTextContent('Cambiar')
  })

  it('shows the name of the resolved active organization', async () => {
    localStorage.setItem(activeContextKey(TENANT.id), '15')
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderEntry()

    expect(await screen.findByText('Operando como Bodegas del Sur')).toBeInTheDocument()
  })

  it('opens the picker from the change action', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderEntry()

    await userEvent.setup().click(await screen.findByRole('button', { name: /cambiar/i }))

    expect(screen.getByText('Selector abierto')).toBeInTheDocument()
  })

  it('names the change action for assistive tech and keeps the visible text in the name', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderEntry()

    const button = await screen.findByRole('button', { name: 'Cambiar de organización' })

    expect(button).toHaveTextContent('Cambiar')
    expect(button.getAttribute('aria-label')).toContain(button.textContent)
  })

  it('shows the loading line while the list loads', () => {
    listMock.mockReturnValue(new Promise(() => {}))
    renderEntry()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando organizaciones…')
  })

  it('shows the generic label, the error and retry when the list fails with a stored organization', async () => {
    localStorage.setItem(activeContextKey(TENANT.id), '12')
    listMock.mockRejectedValue(new Error('Network Error boom'))
    renderEntry()

    expect(await screen.findByText('Operando como tu organización')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus organizaciones')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(localStorage.getItem(activeContextKey(TENANT.id))).toBe('12')
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })

  it('keeps the personal label when the list fails without a stored organization', async () => {
    listMock.mockRejectedValue(new Error('down'))
    renderEntry()

    expect(await screen.findByText('Operando como Modo personal')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus organizaciones')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('retries the list from the error state', async () => {
    listMock.mockRejectedValueOnce(new Error('down'))
    listMock.mockResolvedValue([ORG_A])
    renderEntry()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Operando como Modo personal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('renders nothing when the list is ready and empty', async () => {
    listMock.mockResolvedValue([])
    const { container } = renderEntry()

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders nothing for a landlord and requests no organizations', () => {
    writeSession('tok', { ...TENANT, role: 'landlord' })
    const { container } = renderEntry()

    expect(container).toBeEmptyDOMElement()
    expect(listMock).not.toHaveBeenCalled()
  })

  it('shows only the approved copy and no creation or invitation entry', async () => {
    listMock.mockResolvedValue([ORG_A])
    const { container } = renderEntry()

    await screen.findByText('Operando como Modo personal')

    expect(container.textContent).toBe('Operando como Modo personalCambiar')
    expect(screen.queryByText(/crear organizaci/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invitaci/i)).not.toBeInTheDocument()
  })

  it('reflects the organization picked in the picker when returning to Home', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B, ORG_C])
    render(
      <AuthProvider>
        <ActiveContextProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<ActiveContextEntry />} />
              <Route path="/empresa" element={<SelectCompanyScreen />} />
            </Routes>
          </MemoryRouter>
        </ActiveContextProvider>
      </AuthProvider>,
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Cambiar de organización' }))
    await act(async () => {
      await user.click(await screen.findByRole('button', { name: /Cargas del Norte/ }))
    })

    expect(await screen.findByText('Operando como Cargas del Norte')).toBeInTheDocument()
  })
})
