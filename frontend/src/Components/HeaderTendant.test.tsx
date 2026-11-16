import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Organization } from '../services/organizations';
import type { ActiveContextValue } from '../context/activeContextBase';

const mockLogout = vi.hoisted(() => vi.fn());
const mockGetProfile = vi.hoisted(() => vi.fn());
const mockGetUnreadNotificationsCount = vi.hoisted(() => vi.fn());

vi.mock('../services/profile', () => ({
  getProfile: mockGetProfile,
}));

vi.mock('../services/notifications', () => ({
  getUnreadNotificationsCount: mockGetUnreadNotificationsCount,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

vi.mock('../Dashboard/NotificatiosnDropdown', () => ({
  default: () => <div data-testid="notifications-dropdown" />,
}));

const mockUseInvitationsInbox = vi.hoisted(() => vi.fn());
vi.mock('../context/useInvitationsInbox', () => ({ useInvitationsInbox: mockUseInvitationsInbox }));

const mockUseActiveContext = vi.hoisted(() => vi.fn());
vi.mock('../context/useActiveContext', () => ({ useActiveContext: mockUseActiveContext }));

vi.mock('./ContextSwitcher', () => ({
  default: ({ placement }: { placement: string }) => (
    <div data-testid="context-switcher" data-placement={placement} />
  ),
}));

vi.mock('./ActiveContextRibbon', () => ({
  default: () => <div data-testid="active-context-ribbon" />,
}));

import HeaderTendant from './HeaderTendant';

const andina: Organization = {
  id: 7,
  name: 'Importadora Andina S.A.',
  ruc: '1790012345001',
  email: 'ops@andina.test',
  logo: null,
  status: 'active',
  role: 'admin',
};

function setActiveOrganization(activeOrganization: Organization | null) {
  mockUseActiveContext.mockReturnValue({
    context: activeOrganization
      ? { kind: 'organization', organizationId: activeOrganization.id }
      : { kind: 'personal' },
    activeOrganization,
    organizations: activeOrganization ? [activeOrganization] : [],
    status: 'ready',
    enabled: true,
    selectOrganization: vi.fn(),
    selectPersonal: vi.fn(),
    activateOrganization: vi.fn(),
    reloadOrganizations: vi.fn(),
  } satisfies ActiveContextValue);
}

beforeEach(() => {
  setActiveOrganization(null);
});

function setPendingCount(pendingCount: number) {
  mockUseInvitationsInbox.mockReturnValue({
    pendingCount,
    joinedOrganizationIds: [],
    refreshPendingCount: vi.fn(),
    setPendingCount: vi.fn(),
    markJoinedOrganization: vi.fn(),
  });
}

async function openDrawer() {
  const user = userEvent.setup();
  renderHeader();
  await screen.findAllByText('Ana');
  await user.click(screen.getAllByRole('button').at(-1)!);
  return user;
}

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
    setPendingCount(0);
  });

  it('no longer lists Crear organización as a navigation entry', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.queryByRole('link', { name: 'Crear organización' })).not.toBeInTheDocument();
  });

  it('lists the prototype menu: Catálogo, Mensajes and Mis reservas, without Calendario', async () => {
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/storage');
    expect(screen.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/arrendatario/mensajes');
    expect(screen.getByRole('link', { name: 'Mis reservas' })).toHaveAttribute(
      'href',
      '/arrendatario/mis-reservas',
    );
    expect(screen.queryByRole('link', { name: 'Calendario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bodegas populares' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Crear organización' })).toHaveAttribute(
      'href',
      '/mi-cuenta/crear-organizacion',
    );
  });

  it('the drawer logout entry calls logout and points to /login', async () => {
    const user = await openDrawer();
    await user.click(screen.getByRole('link', { name: 'Cerrar sesión' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Cerrar sesión' })).toHaveAttribute('href', '/login');
  });

  it('renders the active context ribbon right after the navigation bar', async () => {
    const { container } = renderHeader();
    await screen.findAllByText('Ana');

    const ribbon = screen.getByTestId('active-context-ribbon');
    const nav = container.querySelector('nav')!;
    expect(nav.nextElementSibling).toBe(ribbon);
  });
});

describe('HeaderTendant drawer invitations entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({ data: { name: 'Ana', lastname: 'Pérez' } });
    mockGetUnreadNotificationsCount.mockResolvedValue({ data: { count: 0 } });
  });

  it('WS115: appends the pending count to the drawer item', async () => {
    setPendingCount(2);
    await openDrawer();

    expect(screen.getByRole('link', { name: 'Mis invitaciones (2)' })).toHaveAttribute(
      'href',
      '/mi-cuenta/invitaciones',
    );
  });

  it('WS115: shows the bare label when nothing is pending', async () => {
    setPendingCount(0);
    await openDrawer();

    expect(screen.getByRole('link', { name: 'Mis invitaciones' })).toBeInTheDocument();
    expect(screen.queryByText(/\(0\)/)).not.toBeInTheDocument();
  });

  it('keeps the drawer item out of the closed header', async () => {
    setPendingCount(2);
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.queryByRole('link', { name: /Mis invitaciones/ })).not.toBeInTheDocument();
  });

  it('lists the item after the navigation entries and before the account actions', async () => {
    setPendingCount(1);
    await openDrawer();

    const labels = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(labels.at(-3)).toBe('Mis invitaciones (1)');
  });
});

describe('HeaderTendant panel entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue({ data: { name: 'Ana', lastname: 'Pérez' } });
    mockGetUnreadNotificationsCount.mockResolvedValue({ data: { count: 0 } });
    setPendingCount(0);
  });

  it('WS68: lists Panel de la empresa in the desktop navigation while an organization is active', async () => {
    setActiveOrganization(andina);
    renderHeader();
    await screen.findAllByText('Ana');

    expect(screen.getByRole('link', { name: 'Panel de la empresa' })).toHaveAttribute('href', '/organizacion/panel');
  });

  it('WS69: lists the same entry in the mobile drawer', async () => {
    setActiveOrganization(andina);
    await openDrawer();

    const entries = screen.getAllByRole('link', { name: 'Panel de la empresa' });
    expect(entries).toHaveLength(2);
    entries.forEach((entry) => expect(entry).toHaveAttribute('href', '/organizacion/panel'));
  });

  it('WS70: personal context shows the entry in neither the desktop list nor the drawer', async () => {
    setActiveOrganization(null);
    renderHeader();
    await screen.findAllByText('Ana');
    expect(screen.queryByRole('link', { name: 'Panel de la empresa' })).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button').at(-1)!);

    expect(screen.queryByRole('link', { name: 'Panel de la empresa' })).not.toBeInTheDocument();
  });

  it('WS72: keeps the existing entries and the drawer invitations entry next to it', async () => {
    setActiveOrganization(andina);
    setPendingCount(2);
    await openDrawer();

    expect(screen.getAllByRole('link', { name: 'Catálogo' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Mis invitaciones (2)' })).toHaveAttribute(
      'href',
      '/mi-cuenta/invitaciones',
    );
  });
});
