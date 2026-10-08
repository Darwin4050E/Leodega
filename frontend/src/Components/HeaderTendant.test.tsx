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

vi.mock('./ContextSwitcher', () => ({
  default: ({ placement }: { placement: string }) => (
    <div data-testid="context-switcher" data-placement={placement} />
  ),
}));

vi.mock('./ActiveContextRibbon', () => ({
  default: () => <div data-testid="active-context-ribbon" />,
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

  it('no longer lists Crear organización as a navigation entry', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.queryByRole('link', { name: 'Crear organización' })).not.toBeInTheDocument();
  });

  it('keeps the existing navigation entries', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.getByRole('link', { name: 'Bodegas populares' })).toHaveAttribute('href', '/storage');
    expect(screen.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/arrendatario/mensajes');
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute(
      'href',
      '/arrendatario/calendario',
    );
  });

  it('mounts the context switcher once in the desktop action row', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    const switchers = screen.getAllByTestId('context-switcher');
    expect(switchers).toHaveLength(1);
    expect(switchers[0]).toHaveAttribute('data-placement', 'header');
  });

  it('mounts a second switcher in the mobile drawer when it is open', async () => {
    const user = userEvent.setup();
    renderHeader();
    await screen.findAllByText('Ana');

    await user.click(screen.getAllByRole('button').at(-1)!);

    const placements = screen.getAllByTestId('context-switcher').map((node) => node.dataset.placement);
    expect(placements).toEqual(['header', 'drawer']);
    expect(screen.queryByRole('link', { name: 'Crear organización' })).not.toBeInTheDocument();
  });

  it('renders the active context ribbon right after the navigation bar', async () => {
    const { container } = renderHeader();
    await screen.findAllByText('Ana');

    const ribbon = screen.getByTestId('active-context-ribbon');
    const nav = container.querySelector('nav')!;
    expect(nav.nextElementSibling).toBe(ribbon);
  });
});
