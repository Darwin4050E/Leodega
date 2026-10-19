import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useNavigationType } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { writeSession } from '../../auth/session'
import { ActiveContextProvider } from '../../context/ActiveContextProvider'
import { listOrganizations, type Organization } from '../../services/organizations'
import SelectCompanyScreen from './SelectCompanyScreen'

vi.mock('../../services/organizations', () => ({
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

function organization(id: number, overrides: Partial<Organization> = {}): Organization {
  return {
    id,
    name: `Org ${id}`,
    ruc: '0999999999001',
    email: `org${id}@example.com`,
    logo: null,
    status: 'active',
    role: 'member',
    ...overrides,
  }
}

const ORG_A = organization(12, { name: 'Importadora Andina', role: 'admin' })
const ORG_B = organization(15, { name: 'Bodegas del Sur', role: 'member' })

function Landing() {
  return (
    <div>
      <p>Inicio</p>
      <output data-testid="navigation-type">{useNavigationType()}</output>
    </div>
  )
}

function renderScreen(state?: unknown) {
  return render(
    <AuthProvider>
      <ActiveContextProvider>
        <MemoryRouter initialEntries={[{ pathname: '/empresa', state }]}>
          <Routes>
            <Route path="/empresa" element={<SelectCompanyScreen />} />
            <Route path="/" element={<Landing />} />
          </Routes>
        </MemoryRouter>
      </ActiveContextProvider>
    </AuthProvider>,
  )
}

describe('SelectCompanyScreen content', () => {
  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', TENANT)
  })

  it('lists the personal row first, then the organizations in API order', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderScreen()

    await screen.findByText('Importadora Andina')
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Modo personal')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Importadora Andina')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Bodegas del Sur')).toBeInTheDocument()
  })

  it('shows the logo with its alt text, or the initials when there is none', async () => {
    listMock.mockResolvedValue([
      organization(12, { name: 'Importadora Andina', logo: 'https://cdn.example.com/a.png' }),
      organization(15, { name: 'Bodegas del Sur', logo: null }),
    ])
    renderScreen()

    const logo = await screen.findByRole('img', { name: 'Logo de Importadora Andina' })
    expect(logo).toHaveAttribute('src', 'https://cdn.example.com/a.png')
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByText('BD')).toBeInTheDocument()
  })

  it('labels the role of each organization', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderScreen()

    await screen.findByText('Importadora Andina')
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Miembro')).toBeInTheDocument()
  })

  it('renders only copy rows, names and roles: no ruc, email, status or counts', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const { container } = renderScreen()

    await screen.findByText('Importadora Andina')
    expect(container.textContent).toBe(
      [
        '¿Cómo quieres operar?',
        'Elige a nombre de quién quieres operar. Podrás cambiarlo luego.',
        'Modo personal',
        'Reservas a tu nombre',
        'IA',
        'Importadora Andina',
        'Administrador',
        'BD',
        'Bodegas del Sur',
        'Miembro',
        'Volver',
      ].join(''),
    )
  })

  it('marks only the current row with aria-current', async () => {
    localStorage.setItem('leodeguita_active_context:7', '15')
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderScreen()

    await screen.findByText('Bodegas del Sur')
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAccessibleName(/Bodegas del Sur/)
  })

  it('marks the personal row as current when no organization is stored', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderScreen()

    await screen.findByText('Importadora Andina')
    expect(screen.getByRole('button', { name: /Modo personal/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /Importadora Andina/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('truncates a long name visually and keeps the full name in the DOM', async () => {
    const longName = 'N'.repeat(70)
    listMock.mockResolvedValue([organization(12, { name: longName })])
    renderScreen()

    const name = await screen.findByText(longName)
    expect(name).toHaveClass('truncate')
  })

  it('lists inactive and suspended organizations like active ones', async () => {
    listMock.mockResolvedValue([
      organization(12, { name: 'Inactiva', status: 'inactive' }),
      organization(15, { name: 'Suspendida', status: 'suspended' }),
    ])
    renderScreen()

    expect(await screen.findByRole('button', { name: /Inactiva/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Suspendida/ })).toBeEnabled()
  })

  it('offers no create-organization or invitation entry', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderScreen()

    await screen.findByText('Importadora Andina')
    expect(screen.queryByText(/Crear organizaci/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invitaci/i)).not.toBeInTheDocument()
  })

  it('has one level-1 heading that holds focus on mount', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderScreen()

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('¿Cómo quieres operar?')
    expect(headings[0]).toHaveFocus()
    await screen.findByText('Importadora Andina')
  })

  it('exposes rows as buttons named after the organization and its role', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderScreen()

    await screen.findByText('Importadora Andina')
    expect(
      screen.getByRole('button', { name: /Importadora Andina.*Administrador/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bodegas del Sur.*Miembro/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Modo personal.*Reservas a tu nombre/ }),
    ).toBeInTheDocument()
  })

  it('hides decorative avatars from assistive tech', async () => {
    listMock.mockResolvedValue([ORG_A])
    const { container } = renderScreen()

    await screen.findByText('Importadora Andina')
    const hidden = container.querySelectorAll('[aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(3)
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})

const STORAGE_KEY = 'leodeguita_active_context:7'

describe('SelectCompanyScreen selection', () => {
  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', TENANT)
  })

  it('writes the tapped organization and lands on Home', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Bodegas del Sur/ }))

    expect(localStorage.getItem(STORAGE_KEY)).toBe('15')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('removes the stored organization when Modo personal is tapped', async () => {
    localStorage.setItem(STORAGE_KEY, '15')
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const user = userEvent.setup()
    renderScreen()

    await screen.findByText('Bodegas del Sur')
    await user.click(screen.getByRole('button', { name: /Modo personal/ }))

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('only navigates when the current row is tapped', async () => {
    localStorage.setItem(STORAGE_KEY, '15')
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Bodegas del Sur/ }))

    expect(localStorage.getItem(STORAGE_KEY)).toBe('15')
    expect(setItem).not.toHaveBeenCalled()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    setItem.mockRestore()
  })

  it('selects once when the same row is tapped twice in a row', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    renderScreen()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const row = await screen.findByRole('button', { name: /Bodegas del Sur/ })
    act(() => {
      row.click()
      row.click()
    })

    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1)
    setItem.mockRestore()
  })

  it('does not request anything when selecting', async () => {
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Importadora Andina/ }))

    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('replaces the history entry when it navigates home', async () => {
    listMock.mockResolvedValue([ORG_A])
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Importadora Andina/ }))

    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
  })

  it('always offers Volver, which goes home without touching storage', async () => {
    localStorage.setItem(STORAGE_KEY, '15')
    listMock.mockResolvedValue([ORG_A, ORG_B])
    const user = userEvent.setup()
    renderScreen()

    await screen.findByText('Bodegas del Sur')
    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(localStorage.getItem(STORAGE_KEY)).toBe('15')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })

  it('keeps the stored id on a list error and still lets the tenant go personal', async () => {
    localStorage.setItem(STORAGE_KEY, '12')
    listMock.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    await screen.findByRole('button', { name: /Modo personal/ })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('12')

    await user.click(screen.getByRole('button', { name: /Modo personal/ }))

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })
})

describe('SelectCompanyScreen states', () => {
  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', TENANT)
  })

  it('shows the loading line with the personal row and no organizations', () => {
    listMock.mockReturnValue(new Promise(() => undefined))
    renderScreen()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando organizaciones…')
    expect(screen.getByRole('button', { name: /Modo personal/ })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows the error alert and a focusable retry, keeping the personal row selectable', async () => {
    listMock.mockRejectedValue(new Error('Network Error: connect ECONNREFUSED'))
    const { container } = renderScreen()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus organizaciones')
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    retry.focus()
    expect(retry).toHaveFocus()
    expect(screen.getByRole('button', { name: /Modo personal/ })).toBeEnabled()
    expect(container.textContent).not.toMatch(/ECONNREFUSED|Network Error/)
  })

  it('retries the request, shows loading, then the organizations', async () => {
    listMock.mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    let resolve!: (value: Organization[]) => void
    listMock.mockReturnValueOnce(new Promise((res) => (resolve = res)))
    await user.click(retry)

    expect(listMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando organizaciones…')

    await act(async () => resolve([ORG_A]))
    expect(await screen.findByText('Importadora Andina')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error and retry again when the retry fails', async () => {
    listMock.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('redirects to Home with replace when the tenant has no organizations', async () => {
    listMock.mockResolvedValue([])
    renderScreen()

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('SelectCompanyScreen post-login gate', () => {
  const GATE = { postLoginGate: true }

  beforeEach(() => {
    listMock.mockReset()
    writeSession('tok', TENANT)
  })

  it('shows only the loading line while the list loads', () => {
    listMock.mockReturnValue(new Promise(() => undefined))
    renderScreen(GATE)

    expect(screen.getByRole('status')).toHaveTextContent('Cargando organizaciones…')
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modo personal/ })).not.toBeInTheDocument()
  })

  it('shows the picker when the tenant has at least one organization', async () => {
    listMock.mockResolvedValue([ORG_A])
    renderScreen(GATE)

    expect(await screen.findByText('Importadora Andina')).toBeInTheDocument()
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument()
  })

  it('goes to Home when the tenant has no organizations', async () => {
    listMock.mockResolvedValue([])
    renderScreen(GATE)

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
  })

  it('goes to Home on a list error and keeps the stored id', async () => {
    localStorage.setItem(STORAGE_KEY, '12')
    listMock.mockRejectedValue(new Error('network'))
    renderScreen(GATE)

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('12')
  })
})
