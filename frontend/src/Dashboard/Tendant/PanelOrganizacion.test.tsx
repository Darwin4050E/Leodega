import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as renderWithoutRouter, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getPanelSummary: vi.fn(),
  getPanelMembers: vi.fn(),
  getPanelReservations: vi.fn(),
  getPanelHistory: vi.fn(),
  getOrganizationWallet: vi.fn(),
  useActiveContext: vi.fn(),
}));

vi.mock('../../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/organizations')>()),
  getPanelSummary: mocks.getPanelSummary,
  getPanelMembers: mocks.getPanelMembers,
  getPanelReservations: mocks.getPanelReservations,
  getPanelHistory: mocks.getPanelHistory,
  getOrganizationWallet: mocks.getOrganizationWallet,
}));
vi.mock('../../context/useActiveContext', () => ({ useActiveContext: mocks.useActiveContext }));
vi.mock('../../Components/HeaderTendant', () => ({ default: () => <div data-testid="header-tendant" /> }));

import PanelOrganizacion from './PanelOrganizacion';
import { PANEL_COPY } from '../../utils/panelCopy';
import { ORGANIZATION_FORBIDDEN_MESSAGE } from '../../utils/activeContext';

// The sections link to other pages, so every render needs a router.
const render = (ui: ReactElement) => renderWithoutRouter(ui, { wrapper: MemoryRouter });

function organization(overrides = {}) {
  return {
    id: 7,
    name: 'Acme S.A.',
    ruc: '1790012345001',
    email: 'contacto@acme.com',
    logo: null,
    status: 'active',
    role: 'admin',
    ...overrides,
  };
}

function orgContext(overrides = {}) {
  const active = organization(overrides);
  return { context: { kind: 'organization', organizationId: active.id }, activeOrganization: active, enabled: true };
}

const PERSONAL = { context: { kind: 'personal' }, activeOrganization: null, enabled: true };

function summary(overrides = {}) {
  return {
    data: {
      organization_id: 7,
      role: 'admin',
      members_count: 3,
      active_reservations_count: 2,
      pending_invitations_count: 1,
      ...overrides,
    },
  };
}

function memberSummary(overrides = {}) {
  const { data } = summary(overrides);
  delete (data as { pending_invitations_count?: number }).pending_invitations_count;
  return { data: { ...data, role: 'member' } };
}

function apiError(status: number, data: unknown = {}) {
  return { response: { status, data } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('PanelOrganizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActiveContext.mockReturnValue(orgContext());
    mocks.getPanelSummary.mockResolvedValue(summary());
    mocks.getPanelMembers.mockResolvedValue({ data: [] });
    mocks.getOrganizationWallet.mockResolvedValue({ data: { organization_id: 7, balance: '80.50' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('page shell', () => {
    it('WS4: renders a single h1 with the panel title', async () => {
      render(<PanelOrganizacion />);

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: PANEL_COPY.title })).toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
    });

    it('renders under the tenant header', async () => {
      render(<PanelOrganizacion />);

      expect(screen.getByTestId('header-tendant')).toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
    });
  });

  describe('no active organization', () => {
    it('WS5 / WS7: personal context shows the select-an-organization text, no request, no loader or section', () => {
      mocks.useActiveContext.mockReturnValue(PERSONAL);

      render(<PanelOrganizacion />);

      expect(screen.getByText('Selecciona una organización para ver el panel.')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(mocks.getPanelSummary).not.toHaveBeenCalled();
      expect(mocks.getPanelMembers).not.toHaveBeenCalled();
      expect(mocks.getPanelReservations).not.toHaveBeenCalled();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });

    it('WS6: switching from an organization to personal removes the panel content', async () => {
      const { rerender } = render(<PanelOrganizacion />);
      await screen.findByRole('group', { name: 'Miembros activos' });

      mocks.useActiveContext.mockReturnValue(PERSONAL);
      rerender(<PanelOrganizacion />);

      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.queryByText('Acme S.A.')).not.toBeInTheDocument();
      expect(screen.getByText('Selecciona una organización para ver el panel.')).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('WS14 / WS17: shows the initials mark, name, RUC and email from the context without extra requests', async () => {
      render(<PanelOrganizacion />);

      expect(screen.getByText('AS')).toBeInTheDocument();
      expect(screen.getByText('Acme S.A.')).toBeInTheDocument();
      expect(screen.getByText('RUC 1790012345001')).toBeInTheDocument();
      expect(screen.getByText('contacto@acme.com')).toBeInTheDocument();
      expect(screen.getByText('Miembros, reservas y actividad de Acme')).toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(1);
    });

    it('WS17: shows the logo instead of the initials when the organization has one', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ logo: 'https://cdn.test/acme.png' }));

      render(<PanelOrganizacion />);

      expect(screen.getByRole('img', { name: 'Logo de Acme S.A.' })).toHaveAttribute('src', 'https://cdn.test/acme.png');
      expect(screen.queryByText('AS')).not.toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
    });

    it('WS15: an admin gets the Administrador badge', async () => {
      render(<PanelOrganizacion />);

      expect(screen.getByText('Administrador')).toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
    });

    it('WS16: a member gets the Miembro badge', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ role: 'member' }));
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);

      expect(screen.getByText('Miembro')).toBeInTheDocument();
      expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
    });

    it('requests the summary of the active organization only', async () => {
      render(<PanelOrganizacion />);

      await screen.findByRole('group', { name: 'Miembros activos' });
      expect(mocks.getPanelSummary).toHaveBeenCalledWith(7);
    });
  });

  describe('role gating', () => {
    it('WS53 / WS54: a member sees the member notice near the top and no history heading', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ role: 'member' }));
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);

      const notice = screen.getByRole('note');
      expect(within(notice).getByText('Vista de miembro')).toBeInTheDocument();
      expect(within(notice).getByText(PANEL_COPY.memberNoticeBody)).toBeInTheDocument();
      await screen.findByRole('group', { name: 'Miembros activos' });
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });

    it('an admin sees no member notice', async () => {
      render(<PanelOrganizacion />);

      await screen.findByRole('group', { name: 'Miembros activos' });
      expect(screen.queryByText('Vista de miembro')).not.toBeInTheDocument();
    });

    it('WS9: the summary role beats the cached role, so a cached admin turns into the member view without a history request', async () => {
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);

      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
      expect(screen.getByText('Miembro')).toBeInTheDocument();
      expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
      expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });
  });

  describe('summary cards', () => {
    it('shows the loading text while the summary is pending and the cards once it arrives', async () => {
      const pending = deferred<ReturnType<typeof summary>>();
      mocks.getPanelSummary.mockReturnValue(pending.promise);

      render(<PanelOrganizacion />);

      // One polite status per loading section: cards, wallet and members.
      const statuses = screen.getAllByRole('status');
      expect(statuses).toHaveLength(3);
      statuses.forEach((status) => expect(status).toHaveTextContent('Cargando…'));
      expect(screen.getByText('Acme S.A.')).toBeInTheDocument();

      pending.resolve(summary());

      expect(await screen.findByRole('group', { name: 'Reservas vigentes' })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('a server error shows the summary error and keeps the header; Reintentar refetches only the summary', async () => {
      mocks.getPanelSummary.mockRejectedValueOnce(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el resumen');
      expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
      expect(screen.getByText('Acme S.A.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(2);
      expect(mocks.getPanelMembers).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelReservations).not.toHaveBeenCalled();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });
  });

  describe('page-level refusal', () => {
    it('WS13: a 403 shows the server message verbatim and renders no section', async () => {
      mocks.getPanelSummary.mockRejectedValue(apiError(403, { message: 'Mensaje del servidor' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Mensaje del servidor');
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
      expect(screen.queryByText('Acme S.A.')).not.toBeInTheDocument();
    });

    it('WS13: a 403 without a body falls back to the existing not-a-member text', async () => {
      mocks.getPanelSummary.mockRejectedValue(apiError(403));

      render(<PanelOrganizacion />);

      expect(await screen.findByRole('alert')).toHaveTextContent(ORGANIZATION_FORBIDDEN_MESSAGE);
    });
  });

  describe('organization switch', () => {
    it('WS10: switching from org 7 to org 8 resets the summary and never shows an org-7 count under org 8', async () => {
      const second = deferred<ReturnType<typeof summary>>();
      mocks.getPanelSummary.mockResolvedValueOnce(summary({ members_count: 41 })).mockReturnValueOnce(second.promise);

      const { rerender } = render(<PanelOrganizacion />);
      expect(await screen.findByText('41')).toBeInTheDocument();

      mocks.useActiveContext.mockReturnValue(orgContext({ id: 8, name: 'Beta Ltda.' }));
      rerender(<PanelOrganizacion />);

      expect(screen.queryByText('41')).not.toBeInTheDocument();
      expect(screen.getAllByRole('status')[0]).toHaveTextContent('Cargando…');
      expect(screen.getByText('Beta Ltda.')).toBeInTheDocument();
      expect(mocks.getPanelSummary).toHaveBeenLastCalledWith(8);

      second.resolve(summary({ organization_id: 8, members_count: 5 }));

      expect(await screen.findByText('5')).toBeInTheDocument();
      expect(screen.queryByText('41')).not.toBeInTheDocument();
    });

    it('WS57: switching from an admin organization to a member one drops the admin-only content', async () => {
      mocks.getPanelSummary
        .mockResolvedValueOnce(summary())
        .mockResolvedValueOnce(memberSummary({ organization_id: 8 }));

      const { rerender } = render(<PanelOrganizacion />);
      expect(await screen.findByText('Invitaciones pendientes')).toBeInTheDocument();

      mocks.useActiveContext.mockReturnValue(orgContext({ id: 8, name: 'Beta Ltda.', role: 'member' }));
      rerender(<PanelOrganizacion />);

      expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();
      expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Vista de miembro')).toBeInTheDocument());
      expect(await screen.findByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });
  });

  describe('wallet and members sections', () => {
    const ADMIN_MEMBERS = [
      {
        user_id: 1,
        name: 'Ana Pérez',
        role: 'admin',
        joined_at: '2026-06-08T12:00:00Z',
        is_self: true,
        email: 'ana@acme.test',
        monthly_limit: '100.00',
        spent: '40.00',
      },
      {
        user_id: 2,
        name: 'Luis Mora',
        role: 'member',
        joined_at: '2026-07-15T12:00:00Z',
        is_self: false,
        email: 'luis@acme.test',
        monthly_limit: null,
        spent: '25.50',
      },
    ];

    const MEMBER_VIEW_MEMBERS = [
      { user_id: 1, name: 'Ana Pérez', role: 'admin', joined_at: '2026-06-08T12:00:00Z', is_self: false },
      {
        user_id: 2,
        name: 'Luis Mora',
        role: 'member',
        joined_at: '2026-07-15T12:00:00Z',
        is_self: true,
        monthly_limit: '50.00',
        spent: '10.00',
      },
    ];

    it('mounts the wallet balance and the members of the active organization', async () => {
      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText('$80.50')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Billetera de la empresa' })).toBeInTheDocument();
      expect(await screen.findByRole('table', { name: 'Miembros' })).toBeInTheDocument();
      expect(mocks.getPanelMembers).toHaveBeenCalledWith(7);
      expect(mocks.getOrganizationWallet).toHaveBeenCalledWith(7);
    });

    it('the admin sees the invite and manage-limits links, emails and limits', async () => {
      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText(/ana@acme\.test/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Invitar' })).toHaveAttribute('href', '/organizacion/miembros');
      expect(screen.getByRole('link', { name: 'Gestionar límites' })).toHaveAttribute('href', '/organizacion/billetera');
      expect(screen.getByText('$100.00 /mes')).toBeInTheDocument();
    });

    it('WS55: a member sees no email value and no admin links, only their own limit', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ role: 'member' }));
      mocks.getPanelSummary.mockResolvedValue(memberSummary());
      mocks.getPanelMembers.mockResolvedValue({ data: MEMBER_VIEW_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText('$50.00 /mes')).toBeInTheDocument();
      expect(screen.getByText('Solo ves tu propio consumo mensual')).toBeInTheDocument();
      expect(screen.queryByText(/ana@acme\.test|luis@acme\.test/)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Invitar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Gestionar límites' })).not.toBeInTheDocument();
    });

    it('WS9: a cached admin whose summary says member loses the admin links', async () => {
      mocks.getPanelSummary.mockResolvedValue(memberSummary());
      mocks.getPanelMembers.mockResolvedValue({ data: MEMBER_VIEW_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
      await screen.findByRole('table', { name: 'Miembros' });
      expect(screen.queryByRole('link', { name: 'Invitar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Gestionar límites' })).not.toBeInTheDocument();
    });

    it('WS59 / WS61: a members failure shows its error in that section only; Reintentar refetches only the members', async () => {
      mocks.getPanelMembers.mockRejectedValueOnce(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByText('No pudimos cargar los miembros')).toBeInTheDocument();
      expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      expect(await screen.findByText('$80.50')).toBeInTheDocument();

      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('table', { name: 'Miembros' })).toBeInTheDocument();
      expect(mocks.getPanelMembers).toHaveBeenCalledTimes(2);
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(1);
    });

    it('WS26: a wallet failure shows its error in that section only', async () => {
      mocks.getOrganizationWallet.mockRejectedValue(apiError(500));
      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText('No pudimos cargar el saldo')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      expect(await screen.findByRole('table', { name: 'Miembros' })).toBeInTheDocument();
    });

    it('WS58: sections load independently, so the members and the balance show while the summary is pending', async () => {
      const pending = deferred<ReturnType<typeof summary>>();
      mocks.getPanelSummary.mockReturnValue(pending.promise);
      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });

      render(<PanelOrganizacion />);

      expect(await screen.findByText('$80.50')).toBeInTheDocument();
      expect(await screen.findByRole('table', { name: 'Miembros' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.queryByRole('group', { name: 'Miembros activos' })).not.toBeInTheDocument();

      pending.resolve(summary());
      expect(await screen.findByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
    });

    it('WS10: switching organization clears the members and the balance of the previous one', async () => {
      const members = deferred<{ data: typeof ADMIN_MEMBERS }>();
      const wallet = deferred<{ data: { organization_id: number; balance: string } }>();
      mocks.getPanelMembers.mockResolvedValueOnce({ data: ADMIN_MEMBERS }).mockReturnValueOnce(members.promise);
      mocks.getOrganizationWallet
        .mockResolvedValueOnce({ data: { organization_id: 7, balance: '80.50' } })
        .mockReturnValueOnce(wallet.promise);

      const { rerender } = render(<PanelOrganizacion />);
      expect(await screen.findByText('Luis Mora')).toBeInTheDocument();
      expect(await screen.findByText('$80.50')).toBeInTheDocument();

      mocks.useActiveContext.mockReturnValue(orgContext({ id: 8, name: 'Beta Ltda.' }));
      rerender(<PanelOrganizacion />);

      expect(screen.queryByText('Luis Mora')).not.toBeInTheDocument();
      expect(screen.queryByText('$80.50')).not.toBeInTheDocument();
      expect(mocks.getPanelMembers).toHaveBeenLastCalledWith(8);
      expect(mocks.getOrganizationWallet).toHaveBeenLastCalledWith(8);

      members.resolve({ data: [{ ...ADMIN_MEMBERS[1], name: 'Rosa Vega' }] });
      wallet.resolve({ data: { organization_id: 8, balance: '12.00' } });

      expect(await screen.findByText('Rosa Vega')).toBeInTheDocument();
      expect(await screen.findByText('$12.00')).toBeInTheDocument();
      expect(screen.queryByText('Luis Mora')).not.toBeInTheDocument();
    });

    it('WS65 / WS66: the panel offers no form, input or modal', async () => {
      mocks.getPanelMembers.mockResolvedValue({ data: ADMIN_MEMBERS });

      render(<PanelOrganizacion />);

      await screen.findByRole('table', { name: 'Miembros' });
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
