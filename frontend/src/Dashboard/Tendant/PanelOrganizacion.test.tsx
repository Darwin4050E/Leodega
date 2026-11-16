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

function paginator<T>(rows: T[], overrides = {}) {
  return { data: rows, current_page: 1, last_page: 1, per_page: 20, total: rows.length, ...overrides };
}

function reservation(overrides = {}) {
  return {
    id: 11,
    warehouse_name: 'Bodega Norte',
    member_name: 'Ana Pérez',
    start_date: '2026-11-01',
    end_date: '2026-11-30',
    status: 'confirmed',
    total: '120.00',
    paid_with_wallet: true,
    ...overrides,
  };
}

function historyEntry(overrides = {}) {
  return {
    id: 'reservation_created:1',
    kind: 'reservation_created',
    occurred_at: new Date(2026, 5, 8, 9, 12).toISOString(),
    actor_name: 'Ana Pérez',
    target_label: 'Bodega Norte',
    amount: null,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('PanelOrganizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActiveContext.mockReturnValue(orgContext());
    mocks.getPanelSummary.mockResolvedValue(summary());
    mocks.getPanelMembers.mockResolvedValue({ data: [] });
    mocks.getPanelReservations.mockResolvedValue({ data: paginator([]) });
    mocks.getPanelHistory.mockResolvedValue({ data: paginator([]) });
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
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      // The cached admin hint asks once for the feed; once the summary says member it is never asked again.
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('summary cards', () => {
    it('shows the loading text while the summary is pending and the cards once it arrives', async () => {
      const pending = deferred<ReturnType<typeof summary>>();
      mocks.getPanelSummary.mockReturnValue(pending.promise);

      render(<PanelOrganizacion />);

      // One polite status per loading section: cards, wallet, members, reservations and (admin) history.
      const statuses = screen.getAllByRole('status');
      expect(statuses).toHaveLength(5);
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
      expect(mocks.getPanelReservations).toHaveBeenCalledTimes(1);
      // The cached admin hint requested the feed once; retrying the summary does not refetch it.
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);
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
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelHistory).toHaveBeenCalledWith(7, 1);
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
      // Pagination and retry are buttons; nothing may mutate or destroy.
      expect(screen.queryByRole('button', { name: /cancelar|editar|quitar|recargar|eliminar|guardar/i })).not.toBeInTheDocument();
    });
  });

  describe('reservations section', () => {
    it('WS8: requests page 1 of the active organization and renders the rows below the members', async () => {
      mocks.getPanelReservations.mockResolvedValue({ data: paginator([reservation()]) });

      render(<PanelOrganizacion />);

      const table = await screen.findByRole('table', { name: 'Reservas a nombre de la empresa' });
      expect(within(table).getByText('Bodega Norte')).toBeInTheDocument();
      expect(mocks.getPanelReservations).toHaveBeenCalledWith(7, 1);
      const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
      expect(headings.indexOf('Reservas a nombre de la empresa')).toBeGreaterThan(headings.indexOf('Miembros'));
    });

    it('a member gets the reduced subtitle from the same section', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ role: 'member' }));
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);

      expect(await screen.findByText(/Solo ves las reservas que hiciste/)).toBeInTheDocument();
      expect(screen.getByText('Aún no tienes reservas a nombre de la empresa.')).toBeInTheDocument();
    });

    it('WS12: moving to page 2 requests page 2 and shows only its rows (the late-response guard is covered in the hook)', async () => {
      mocks.getPanelReservations
        .mockResolvedValueOnce({ data: paginator([reservation()], { last_page: 2 }) })
        .mockResolvedValueOnce({
          data: paginator([reservation({ id: 12, warehouse_name: 'Bodega Sur' })], { current_page: 2, last_page: 2 }),
        });

      render(<PanelOrganizacion />);
      await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));

      expect(await screen.findByText('Bodega Sur')).toBeInTheDocument();
      expect(mocks.getPanelReservations).toHaveBeenLastCalledWith(7, 2);
      expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument();
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    });

    it('WS10: switching organization returns to page 1 of the new one and clears the rows', async () => {
      const second = deferred<{ data: ReturnType<typeof paginator> }>();
      mocks.getPanelReservations
        .mockResolvedValueOnce({ data: paginator([reservation()]) })
        .mockReturnValueOnce(second.promise);

      const { rerender } = render(<PanelOrganizacion />);
      expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();

      mocks.useActiveContext.mockReturnValue(orgContext({ id: 8, name: 'Beta Ltda.' }));
      rerender(<PanelOrganizacion />);

      expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument();
      expect(mocks.getPanelReservations).toHaveBeenLastCalledWith(8, 1);
      second.resolve({ data: paginator([reservation({ id: 30, warehouse_name: 'Bodega Beta' })]) });
      expect(await screen.findByText('Bodega Beta')).toBeInTheDocument();
    });

    it('WS59 / WS61: a failure stays in this section and Reintentar refetches only the reservations', async () => {
      mocks.getPanelReservations.mockRejectedValueOnce(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByText('No pudimos cargar las reservas')).toBeInTheDocument();
      expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();

      mocks.getPanelReservations.mockResolvedValue({ data: paginator([reservation()]) });
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();
      expect(mocks.getPanelReservations).toHaveBeenCalledTimes(2);
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelMembers).toHaveBeenCalledTimes(1);
    });

    it('WS67: the link to the caller reservations only navigates', async () => {
      render(<PanelOrganizacion />);

      expect(await screen.findByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute(
        'href',
        '/arrendatario/mis-reservas',
      );
    });
  });

  describe('history section', () => {
    it('WS8 / WS44: an admin requests page 1 of the history of the active organization and sees it below the reservations', async () => {
      mocks.getPanelHistory.mockResolvedValue({ data: paginator([historyEntry()]) });

      render(<PanelOrganizacion />);

      const section = await screen.findByRole('region', { name: 'Historial de acciones' });
      expect(within(section).getByText('Bodega Norte')).toBeInTheDocument();
      expect(mocks.getPanelHistory).toHaveBeenCalledWith(7, 1);
      const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
      expect(headings.indexOf('Historial de acciones')).toBeGreaterThan(headings.indexOf('Reservas a nombre de la empresa'));
    });

    it('WS54 / WS56: a member never requests the history, has no heading and no admin-only control', async () => {
      mocks.useActiveContext.mockReturnValue(orgContext({ role: 'member' }));
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);

      await screen.findByRole('group', { name: 'Miembros activos' });
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /invitar|recargar|editar límite|quitar|cancelar/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /invitar|recargar|editar límite|quitar|cancelar|gestionar límites/i }),
      ).not.toBeInTheDocument();
    });

    it('WS9: a cached admin turned member loses the section and a late history refusal stays silent', async () => {
      const history = deferred<{ data: ReturnType<typeof paginator> }>();
      mocks.getPanelHistory.mockReturnValue(history.promise);
      mocks.getPanelSummary.mockResolvedValue(memberSummary());

      render(<PanelOrganizacion />);
      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();

      history.reject(apiError(403, { message: 'No autorizado' }));
      await waitFor(() => expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      expect(screen.queryByText('No autorizado')).not.toBeInTheDocument();
      expect(screen.queryByText('No pudimos cargar el historial')).not.toBeInTheDocument();
    });

    it('WS52: a 403 on the history removes only that section, silently', async () => {
      mocks.getPanelHistory.mockRejectedValue(apiError(403, { message: 'No autorizado' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      await waitFor(() => expect(mocks.getPanelHistory).toHaveBeenCalled());
      expect(screen.queryByText('Historial de acciones')).not.toBeInTheDocument();
      expect(screen.queryByText('No autorizado')).not.toBeInTheDocument();
      expect(screen.queryByText('No pudimos cargar el historial')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Reservas a nombre de la empresa' })).toBeInTheDocument();
    });

    it('moving to page 2 requests page 2 of the history only', async () => {
      mocks.getPanelHistory
        .mockResolvedValueOnce({ data: paginator([historyEntry()], { last_page: 2 }) })
        .mockResolvedValueOnce({
          data: paginator([historyEntry({ id: 'member_joined:2', kind: 'member_joined', actor_name: 'Luis Mora' })], {
            current_page: 2,
            last_page: 2,
          }),
        });

      render(<PanelOrganizacion />);
      await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));

      expect(await screen.findByText('Luis Mora')).toBeInTheDocument();
      expect(mocks.getPanelHistory).toHaveBeenLastCalledWith(7, 2);
      expect(mocks.getPanelReservations).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    });

    it('WS10 / WS11: switching organization returns the history to page 1, clears the rows and discards a late org-7 answer', async () => {
      const late = deferred<{ data: ReturnType<typeof paginator> }>();
      mocks.getPanelHistory
        .mockResolvedValueOnce({ data: paginator([historyEntry()], { last_page: 2 }) })
        .mockReturnValueOnce(late.promise)
        .mockResolvedValue({
          data: paginator([historyEntry({ id: 'member_joined:9', kind: 'member_joined', actor_name: 'Rosa Vega' })]),
        });

      const { rerender } = render(<PanelOrganizacion />);
      await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
      expect(mocks.getPanelHistory).toHaveBeenLastCalledWith(7, 2);

      mocks.useActiveContext.mockReturnValue(orgContext({ id: 8, name: 'Beta Ltda.' }));
      rerender(<PanelOrganizacion />);

      expect(screen.queryByText('Bodega Norte')).not.toBeInTheDocument();
      expect(mocks.getPanelHistory).toHaveBeenLastCalledWith(8, 1);
      expect(await screen.findByText('Rosa Vega')).toBeInTheDocument();

      // The page-2 answer of org 7 arrives after the switch and must not replace what org 8 shows.
      late.resolve({ data: paginator([historyEntry({ actor_name: 'Fantasma' })], { current_page: 2, last_page: 2 }) });
      await waitFor(() => expect(mocks.getPanelHistory).toHaveBeenCalledTimes(3));
      expect(screen.getByText('Rosa Vega')).toBeInTheDocument();
      expect(screen.queryByText('Fantasma')).not.toBeInTheDocument();
    });

    it('WS59 / WS61: a failure stays in this section and Reintentar refetches only the history', async () => {
      mocks.getPanelHistory.mockRejectedValueOnce(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      render(<PanelOrganizacion />);

      expect(await screen.findByText('No pudimos cargar el historial')).toBeInTheDocument();
      expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();

      mocks.getPanelHistory.mockResolvedValue({ data: paginator([historyEntry()]) });
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Bodega Norte')).toBeInTheDocument();
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(2);
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelMembers).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelReservations).toHaveBeenCalledTimes(1);
    });

    it('WS62: an empty history and empty reservations each show their own text while cards, wallet and members stay', async () => {
      render(<PanelOrganizacion />);

      expect(await screen.findByText('Aún no hay actividad en la empresa.')).toBeInTheDocument();
      expect(
        screen.getByText('Aún no hay reservas a nombre de la empresa. Reserva en contexto de empresa desde el catálogo.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Miembros activos' })).toBeInTheDocument();
      expect(await screen.findByText('$80.50')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Miembros' })).toBeInTheDocument();
    });

    it('WS63: an organization with only its creator shows one member row and the cards 1 / 0 / 0', async () => {
      mocks.getPanelSummary.mockResolvedValue(
        summary({ members_count: 1, active_reservations_count: 0, pending_invitations_count: 0 }),
      );
      mocks.getPanelMembers.mockResolvedValue({
        data: [
          {
            user_id: 1,
            name: 'Ana Pérez',
            role: 'admin',
            joined_at: '2026-06-08T12:00:00Z',
            is_self: true,
            email: 'ana@acme.test',
            monthly_limit: null,
            spent: '0.00',
          },
        ],
      });
      mocks.getPanelHistory.mockResolvedValue({
        data: paginator([historyEntry({ id: 'member_joined:1', kind: 'member_joined', target_label: null })]),
      });

      render(<PanelOrganizacion />);

      const table = await screen.findByRole('table', { name: 'Miembros' });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(within(screen.getByRole('group', { name: 'Miembros activos' })).getByText('1')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Reservas vigentes' })).getByText('0')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Invitaciones pendientes' })).getByText('0')).toBeInTheDocument();
      expect(await screen.findByText('se unió a la organización', { exact: false })).toBeInTheDocument();
    });

    it('WS65 / WS66: with every section populated the page still has no form, input, dialog or destructive button', async () => {
      mocks.getPanelReservations.mockResolvedValue({ data: paginator([reservation()]) });
      mocks.getPanelHistory.mockResolvedValue({ data: paginator([historyEntry()], { last_page: 2 }) });

      render(<PanelOrganizacion />);

      await screen.findByRole('region', { name: 'Historial de acciones' });
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /cancelar|editar|quitar|recargar|eliminar|guardar/i }),
      ).not.toBeInTheDocument();
    });
  });
});
