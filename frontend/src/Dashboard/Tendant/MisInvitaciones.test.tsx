import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getOrganizations: vi.fn(),
  getMyInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
}));

vi.mock('../../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/organizations')>()),
  getOrganizations: mocks.getOrganizations,
  getMyInvitations: mocks.getMyInvitations,
  acceptInvitation: mocks.acceptInvitation,
  rejectInvitation: mocks.rejectInvitation,
}));
vi.mock('../../Components/HeaderTendant', () => ({ default: () => <div data-testid="header-tendant" /> }));

import { ActiveContextProvider } from '../../context/ActiveContext';
import { AuthProvider } from '../../context/AuthContext';
import { InvitationsInboxProvider } from '../../context/InvitationsInboxContext';
import { useActiveContext } from '../../context/useActiveContext';
import { useInvitationsInbox } from '../../context/useInvitationsInbox';
import { writeStoredOrganizationId } from '../../utils/activeContext';
import MisInvitaciones from './MisInvitaciones';

const USER_ID = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function item(id: number, overrides = {}) {
  return {
    id,
    organization_id: 100 + id,
    organization_name: `Empresa ${id} S.A.`,
    invited_by_name: 'María López',
    role: 'member',
    status: 'pending',
    expires_at: new Date(Date.now() + 5 * DAY_MS).toISOString(),
    created_at: '2026-06-08T12:00:00Z',
    responded_at: null,
    can_respond: true,
    ...overrides,
  };
}

function expiredItem(id: number) {
  return item(id, { status: 'expired', can_respond: false });
}

function inbox(items: unknown[], pendingCount = items.filter((entry) => (entry as { status: string }).status === 'pending').length) {
  return { data: { data: items, pending_count: pendingCount } };
}

function apiError(status: number, data: unknown = {}) {
  return { response: { status, data } };
}

// Reads what the page is allowed to change, from the real providers.
const StateProbe = () => {
  const active = useActiveContext();
  const sharedInbox = useInvitationsInbox();
  const location = useLocation();
  return (
    <dl data-testid="probe">
      <dt>path</dt>
      <dd data-testid="probe-path">{location.pathname}</dd>
      <dt>context</dt>
      <dd data-testid="probe-context">
        {active.context.kind === 'organization' ? `organization:${active.context.organizationId}` : 'personal'}
      </dd>
      <dt>pending</dt>
      <dd data-testid="probe-pending">{sharedInbox.pendingCount}</dd>
      <dt>joined</dt>
      <dd data-testid="probe-joined">{sharedInbox.joinedOrganizationIds.join(',')}</dd>
      <dt>organizations</dt>
      <dd data-testid="probe-organizations">{active.organizations.map((organization) => organization.name).join('|')}</dd>
    </dl>
  );
};

function renderPage() {
  localStorage.setItem('auth_token', 'tok');
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: USER_ID, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', role: 'tenant' }),
  );

  return render(
    <MemoryRouter initialEntries={['/mi-cuenta/invitaciones']}>
      <AuthProvider>
        <ActiveContextProvider>
          <InvitationsInboxProvider>
            <StateProbe />
            <Routes>
              <Route path="/mi-cuenta/invitaciones" element={<MisInvitaciones />} />
              <Route path="/arrendatario/dashboard" element={<p>Panel del arrendatario</p>} />
            </Routes>
          </InvitationsInboxProvider>
        </ActiveContextProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function renderLoadedPage() {
  const view = renderPage();
  await screen.findByRole('heading', { name: 'Invitaciones', level: 1 });
  await waitFor(() => expect(screen.queryByText('Cargando invitaciones…')).not.toBeInTheDocument());
  return view;
}

const SUBTITLE = 'Organizaciones que te invitaron a operar en su nombre.';

describe('MisInvitaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getOrganizations.mockResolvedValue({ data: [] });
    mocks.getMyInvitations.mockResolvedValue(inbox([item(1), item(2)]));
  });

  describe('states', () => {
    it('WS65/WS68: shows the heading, the subtitle and the loading text, and no card, while the request is pending', async () => {
      mocks.getMyInvitations.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByRole('heading', { name: 'Invitaciones', level: 1 })).toBeInTheDocument();
      expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
      expect(screen.getByText('Cargando invitaciones…')).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('WS66/WS68: a failed request shows the alert with Reintentar, and Reintentar requests the inbox again', async () => {
      const user = userEvent.setup();
      mocks.getMyInvitations.mockRejectedValue(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      renderPage();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No pudimos cargar las invitaciones');
      expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Invitaciones', level: 1 })).toBeInTheDocument();
      expect(screen.getByText(SUBTITLE)).toBeInTheDocument();

      const callsBeforeRetry = mocks.getMyInvitations.mock.calls.length;
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));

      await screen.findByRole('article');
      expect(mocks.getMyInvitations.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('WS67/WS68: an empty inbox shows the plain empty state under the heading and subtitle', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([]));

      await renderLoadedPage();

      expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'No tienes invitaciones' })).toBeInTheDocument();
      expect(screen.getByText('Cuando una empresa te invite, aparecerá aquí.')).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });

    it('WS68: the list state keeps the heading and the subtitle', async () => {
      await renderLoadedPage();

      expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
  });

  describe('cards', () => {
    it('WS77: three pending items render three cards, each with its own buttons', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1), item(2), item(3)]));

      await renderLoadedPage();

      const cards = screen.getAllByRole('article');
      expect(cards).toHaveLength(3);
      for (const card of cards) {
        expect(within(card).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument();
      }
    });

    it('WS74: pending and expired items keep the server order', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1), expiredItem(9), item(3), expiredItem(7)], 2));

      await renderLoadedPage();

      const names = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
      expect(names).toEqual(['Empresa 1 S.A.', 'Empresa 9 S.A.', 'Empresa 3 S.A.', 'Empresa 7 S.A.']);
    });

    it('WS72/WS73: an expired item has no actions and Solicitar nueva invitación never shows', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1), expiredItem(9)], 1));

      await renderLoadedPage();

      const [pending, expired] = screen.getAllByRole('article');
      expect(within(pending).getByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument();
      expect(within(expired).queryByRole('button')).not.toBeInTheDocument();
      expect(within(expired).getByText('Expirada')).toBeInTheDocument();
      expect(screen.queryByText('Solicitar nueva invitación')).not.toBeInTheDocument();
    });
  });

  describe('shared state', () => {
    it('WS83/WS119: publishes pending_count (not the list length) to the shared inbox count', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1), item(2), item(3), expiredItem(8), expiredItem(9)], 3));

      await renderLoadedPage();

      await waitFor(() => expect(screen.getByTestId('probe-pending')).toHaveTextContent('3'));
    });

    it('WS63/WS64: renders the same page under an organization context and sends no organization-addressed request', async () => {
      mocks.getOrganizations.mockResolvedValue({
        data: [{ id: 7, name: 'Acme S.A.', ruc: '1790012345001', email: 'a@acme.com', logo: null, status: 'active', role: 'member' }],
      });
      writeStoredOrganizationId(USER_ID, 7);

      await renderLoadedPage();

      expect(screen.getByTestId('probe-context')).toHaveTextContent('organization:7');
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(mocks.getMyInvitations).toHaveBeenCalledWith();
      expect(mocks.acceptInvitation).not.toHaveBeenCalled();
      expect(mocks.rejectInvitation).not.toHaveBeenCalled();
    });
  });

  describe('respond actions', () => {
    function cardOf(name: string) {
      return screen.getByRole('heading', { name }).closest('article') as HTMLElement;
    }

    it('WS84: Aceptar invitación sends the request for that card and makes only its buttons inert', async () => {
      const user = userEvent.setup();
      mocks.acceptInvitation.mockReturnValue(new Promise(() => {}));
      await renderLoadedPage();

      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Aceptar invitación' }));

      expect(mocks.acceptInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.acceptInvitation).toHaveBeenCalledWith(1);
      const first = cardOf('Empresa 1 S.A.');
      expect(within(first).getByRole('button', { name: 'Aceptando...' })).toBeDisabled();
      expect(within(first).getByRole('button', { name: 'Rechazar' })).toBeDisabled();
      const second = cardOf('Empresa 2 S.A.');
      expect(within(second).getByRole('button', { name: 'Aceptar invitación' })).toBeEnabled();
      expect(within(second).getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    });

    it('WS85: clicking again while in flight sends no second request', async () => {
      const user = userEvent.setup();
      mocks.acceptInvitation.mockReturnValue(new Promise(() => {}));
      await renderLoadedPage();
      const accept = within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Aceptar invitación' });

      await user.click(accept);
      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Aceptando...' }));

      expect(mocks.acceptInvitation).toHaveBeenCalledTimes(1);
    });

    it('WS86: Rechazar sends the request at once with Rechazando... and opens no dialog', async () => {
      const user = userEvent.setup();
      mocks.rejectInvitation.mockReturnValue(new Promise(() => {}));
      await renderLoadedPage();

      await user.click(within(cardOf('Empresa 2 S.A.')).getByRole('button', { name: 'Rechazar' }));

      expect(mocks.rejectInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.rejectInvitation).toHaveBeenCalledWith(2);
      expect(within(cardOf('Empresa 2 S.A.')).getByRole('button', { name: 'Rechazando...' })).toBeDisabled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it.each([
      ['WS87', 409, 'Ya respondiste esta invitación'],
      ['WS88', 404, 'Invitación no encontrada'],
    ])('%s: a %i shows the server text in an alert and reloads the inbox', async (_ws, status, message) => {
      const user = userEvent.setup();
      mocks.acceptInvitation.mockRejectedValue(apiError(status, { message }));
      await renderLoadedPage();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Aceptar invitación' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Empresa 1 S.A.' })).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Empresa 2 S.A.' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(message);
    });

    it.each([
      ['WS89', 'accept', apiError(500, { message: 'SQLSTATE[HY000] boom' }), 'No se pudo aceptar la invitación. Intenta nuevamente.'],
      ['WS90', 'reject', apiError(503, { message: 'Server Error' }), 'No se pudo rechazar la invitación. Intenta nuevamente.'],
      ['WS91', 'accept', apiError(403, { message: 'No autorizado' }), 'No se pudo aceptar la invitación. Intenta nuevamente.'],
    ])('%s: the generic %s error shows, the framework text never does, and the buttons work again', async (_ws, action, error, expected) => {
      const user = userEvent.setup();
      (action === 'accept' ? mocks.acceptInvitation : mocks.rejectInvitation).mockRejectedValue(error);
      await renderLoadedPage();
      const label = action === 'accept' ? 'Aceptar invitación' : 'Rechazar';

      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: label }));

      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(screen.queryByText(/SQLSTATE|Server Error|No autorizado/)).not.toBeInTheDocument();
      expect(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: label })).toBeEnabled();
    });

    it('WS93: a successful reject shows no toast and no status message', async () => {
      const user = userEvent.setup();
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      await renderLoadedPage();

      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Rechazar' }));

      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Empresa 1 S.A.' })).not.toBeInTheDocument());
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('WS94: a completed reject refreshes the shared badge count from the server', async () => {
      const user = userEvent.setup();
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      await renderLoadedPage();
      await waitFor(() => expect(screen.getByTestId('probe-pending')).toHaveTextContent('2'));
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      await user.click(within(cardOf('Empresa 1 S.A.')).getByRole('button', { name: 'Rechazar' }));

      await waitFor(() => expect(screen.getByTestId('probe-pending')).toHaveTextContent('1'));
    });
  });

  describe('accepting', () => {
    function organization(id: number, name: string, overrides = {}) {
      return { id, name, ruc: '1790012345001', email: 'info@acme.com', logo: null, status: 'active', role: 'member', ...overrides };
    }

    const ANDINA = organization(101, 'Importadora Andina S.A.');

    function cardOf(name: string) {
      return screen.getByRole('heading', { name }).closest('article') as HTMLElement;
    }

    async function acceptFirst(user: ReturnType<typeof userEvent.setup>, label = 'Empresa 1 S.A.') {
      await user.click(within(cardOf(label)).getByRole('button', { name: 'Aceptar invitación' }));
      return screen.findByRole('status');
    }

    function seedOrganizationContext() {
      mocks.getOrganizations.mockResolvedValue({ data: [organization(7, 'Acme S.A.')] });
      writeStoredOrganizationId(USER_ID, 7);
    }

    beforeEach(() => {
      mocks.acceptInvitation.mockResolvedValue({ data: ANDINA });
    });

    it('WS95: replaces the accepted card with the confirmation, in the same position, with no toast', async () => {
      const user = userEvent.setup();
      await renderLoadedPage();

      const confirmation = await acceptFirst(user);

      expect(within(confirmation).getByRole('heading', { name: 'Te uniste a Importadora Andina' })).toBeInTheDocument();
      expect(within(confirmation).getByText('Rol: Miembro')).toBeInTheDocument();
      expect(within(confirmation).getByText('Unido')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Empresa 1 S.A.' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('status')).toHaveLength(1);
      const blocks = screen.getAllByRole('status').concat(screen.getAllByRole('article'));
      expect(blocks[0].compareDocumentPosition(blocks[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Empresa 2 S.A.' })).toBeInTheDocument();
    });

    it('WS96/WS97: asks for the organization list again, tags the org as joined and stays personal', async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      const callsBefore = mocks.getOrganizations.mock.calls.length;

      await acceptFirst(user);

      await waitFor(() => expect(mocks.getOrganizations.mock.calls.length).toBe(callsBefore + 1));
      expect(screen.getByTestId('probe-context')).toHaveTextContent('personal');
      expect(screen.getByTestId('probe-joined')).toHaveTextContent('101');
    });

    it('WS97: with another organization active, that organization stays active', async () => {
      const user = userEvent.setup();
      seedOrganizationContext();
      await renderLoadedPage();

      await acceptFirst(user);

      expect(screen.getByTestId('probe-context')).toHaveTextContent('organization:7');
    });

    it('WS98: the joined organization appears in the organization list after the reload', async () => {
      const user = userEvent.setup();
      mocks.getOrganizations.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: [ANDINA] });
      await renderLoadedPage();

      await acceptFirst(user);

      await waitFor(() => expect(screen.getByTestId('probe-organizations')).toHaveTextContent('Importadora Andina S.A.'));
    });

    it('WS99/WS101: Operar como activates the organization from the response and goes to the tenant home', async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      const confirmation = await acceptFirst(user);

      await user.click(within(confirmation).getByRole('button', { name: 'Operar como Importadora Andina' }));

      expect(await screen.findByText('Panel del arrendatario')).toBeInTheDocument();
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/arrendatario/dashboard');
      expect(screen.getByTestId('probe-context')).toHaveTextContent('organization:101');
      expect(screen.getByTestId('probe-organizations')).toHaveTextContent('Importadora Andina S.A.');
    });

    it('WS100: Operar como still works when the organization list reload fails', async () => {
      const user = userEvent.setup();
      mocks.getOrganizations.mockResolvedValueOnce({ data: [] }).mockRejectedValue(apiError(500));
      await renderLoadedPage();
      const confirmation = await acceptFirst(user);
      expect(within(confirmation).getByRole('heading', { name: 'Te uniste a Importadora Andina' })).toBeInTheDocument();

      await user.click(within(confirmation).getByRole('button', { name: 'Operar como Importadora Andina' }));

      expect(await screen.findByText('Panel del arrendatario')).toBeInTheDocument();
      expect(screen.getByTestId('probe-context')).toHaveTextContent('organization:101');
    });

    it('WS102: Seguir en personal from an organization context selects personal and dismisses the confirmation', async () => {
      const user = userEvent.setup();
      seedOrganizationContext();
      await renderLoadedPage();
      const confirmation = await acceptFirst(user);

      await user.click(within(confirmation).getByRole('button', { name: 'Seguir en personal' }));

      expect(screen.getByTestId('probe-context')).toHaveTextContent('personal');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/mi-cuenta/invitaciones');
      expect(screen.getByRole('heading', { name: 'Empresa 2 S.A.' })).toBeInTheDocument();
    });

    it('WS103/WS110: dismissing the last confirmation shows the plain empty state, not the reject one', async () => {
      const user = userEvent.setup();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      await renderLoadedPage();
      const confirmation = await acceptFirst(user);

      await user.click(within(confirmation).getByRole('button', { name: 'Seguir en personal' }));

      expect(screen.getByRole('heading', { name: 'No tienes invitaciones' })).toBeInTheDocument();
      expect(screen.getByText('Cuando una empresa te invite, aparecerá aquí.')).toBeInTheDocument();
      expect(screen.queryByText('No tienes invitaciones pendientes')).not.toBeInTheDocument();
    });

    it('WS104: two accepted invitations give two independent confirmations', async () => {
      const user = userEvent.setup();
      mocks.acceptInvitation
        .mockResolvedValueOnce({ data: organization(101, 'Importadora Andina S.A.') })
        .mockResolvedValueOnce({ data: organization(102, 'Norte Cía. Ltda.') });
      await renderLoadedPage();

      await acceptFirst(user, 'Empresa 1 S.A.');
      await user.click(within(cardOf('Empresa 2 S.A.')).getByRole('button', { name: 'Aceptar invitación' }));
      await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));

      const [first, second] = screen.getAllByRole('status');
      expect(within(first).getByRole('button', { name: 'Operar como Importadora Andina' })).toBeInTheDocument();
      expect(within(second).getByRole('button', { name: 'Operar como Norte' })).toBeInTheDocument();

      await user.click(within(first).getByRole('button', { name: 'Seguir en personal' }));
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(within(screen.getByRole('status')).getByRole('heading', { name: 'Te uniste a Norte' })).toBeInTheDocument();
    });

    it('WS106: leaving the page and coming back lists the remaining invitations and no confirmation', async () => {
      const user = userEvent.setup();
      const first = await renderLoadedPage();
      await acceptFirst(user);
      first.unmount();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      await renderLoadedPage();

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Empresa 1 S.A.' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Empresa 2 S.A.' })).toBeInTheDocument();
    });
  });

  describe('rejecting', () => {
    function cardOf(name: string) {
      return screen.getByRole('heading', { name }).closest('article') as HTMLElement;
    }

    async function rejectCard(user: ReturnType<typeof userEvent.setup>, name: string) {
      await user.click(within(cardOf(name)).getByRole('button', { name: 'Rechazar' }));
    }

    beforeEach(() => {
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
    });

    it('WS107/WS108: the rejected card disappears, the others stay, nothing else changes', async () => {
      const user = userEvent.setup();
      await renderLoadedPage();
      const callsBefore = mocks.getOrganizations.mock.calls.length;

      await rejectCard(user, 'Empresa 1 S.A.');

      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Empresa 1 S.A.' })).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Empresa 2 S.A.' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(mocks.getOrganizations.mock.calls.length).toBe(callsBefore);
      expect(screen.getByTestId('probe-context')).toHaveTextContent('personal');
      expect(screen.getByTestId('probe-joined')).toHaveTextContent('');
    });

    it('WS109: rejecting the last card shows the post-reject empty state', async () => {
      const user = userEvent.setup();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      await renderLoadedPage();

      await rejectCard(user, 'Empresa 1 S.A.');

      expect(await screen.findByRole('heading', { name: 'No tienes invitaciones pendientes' })).toBeInTheDocument();
      expect(
        screen.getByText('Rechazaste la invitación. No hubo ningún cambio en tu cuenta y seguirás operando en modo personal.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('No tienes invitaciones')).not.toBeInTheDocument();
    });

    it('WS111: leaving and coming back shows the plain empty state', async () => {
      const user = userEvent.setup();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      const first = await renderLoadedPage();
      await rejectCard(user, 'Empresa 1 S.A.');
      await screen.findByRole('heading', { name: 'No tienes invitaciones pendientes' });
      first.unmount();
      mocks.getMyInvitations.mockResolvedValue(inbox([]));

      await renderLoadedPage();

      expect(screen.getByRole('heading', { name: 'No tienes invitaciones' })).toBeInTheDocument();
      expect(screen.queryByText('No tienes invitaciones pendientes')).not.toBeInTheDocument();
    });
  });
});
