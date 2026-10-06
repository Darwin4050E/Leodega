import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetProfile = vi.hoisted(() => vi.fn());
const mockGetUnreadNotificationsCount = vi.hoisted(() => vi.fn());

vi.mock('../services/profile', () => ({
  getProfile: mockGetProfile,
}));

vi.mock('../services/notifications', () => ({
  getUnreadNotificationsCount: mockGetUnreadNotificationsCount,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../Dashboard/NotificatiosnDropdown', () => ({
  default: () => <div data-testid="notifications-dropdown" />,
}));

import HeaderTendant from './HeaderTendant';

function renderHeader() {
  return render(
    <MemoryRouter>
      <HeaderTendant />
    </MemoryRouter>,
  );
}

describe('HeaderTendant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({ data: { name: 'Ana', lastname: 'Pérez' } });
    mockGetUnreadNotificationsCount.mockResolvedValue({ data: { count: 0 } });
  });

  it('links the Crear organización entry to the create-organization route', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.getByRole('link', { name: 'Crear organización' })).toHaveAttribute(
      'href',
      '/mi-cuenta/crear-organizacion',
    );
  });

  it('keeps the existing navigation entries next to the new one', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.getByRole('link', { name: 'Bodegas populares' })).toHaveAttribute('href', '/storage');
    expect(screen.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/arrendatario/mensajes');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute(
      'href',
      '/arrendatario/calendario',
    );
  });

  it('also offers the entry in the mobile drawer', async () => {
    const user = userEvent.setup();
    renderHeader();
    await screen.findAllByText('Ana');
    expect(screen.getAllByRole('link', { name: 'Crear organización' })).toHaveLength(1);

    await user.click(screen.getAllByRole('button').at(-1)!);

    expect(screen.getAllByRole('link', { name: 'Crear organización' })).toHaveLength(2);
  });
});
