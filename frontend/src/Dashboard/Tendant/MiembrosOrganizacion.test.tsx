import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  getInvitations: vi.fn(),
  inviteMember: vi.fn(),
  revokeInvitation: vi.fn(),
  useActiveContext: vi.fn(),
}));

vi.mock('../../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/organizations')>()),
  getInvitations: mocks.getInvitations,
  inviteMember: mocks.inviteMember,
  revokeInvitation: mocks.revokeInvitation,
}));
vi.mock('../../context/useActiveContext', () => ({ useActiveContext: mocks.useActiveContext }));
vi.mock('../../Components/HeaderTendant', () => ({ default: () => <div data-testid="header-tendant" /> }));

import MiembrosOrganizacion from './MiembrosOrganizacion';

function orgContext(role: 'admin' | 'member', id = 7, name = 'Acme S.A.') {
  return {
    context: { kind: 'organization', organizationId: id },
    activeOrganization: { id, name, role },
    enabled: true,
  };
}

const PERSONAL = { context: { kind: 'personal' }, activeOrganization: null, enabled: true };

function invitation(id: number, overrides = {}) {
  return {
    id,
    email: `user${id}@x.com`,
    status: 'pending',
    expires_at: '2026-06-15T12:00:00Z',
    created_at: '2026-06-08T12:00:00Z',
    responded_at: null,
    invited_by_name: 'María López',
    can_be_revoked: true,
    ...overrides,
  };
}

function paginated(items: unknown[], overrides = {}) {
  return {
    data: {
      data: items,
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: items.length,
      pending_count: items.length,
      ...overrides,
    },
  };
}

function apiError(status: number, data: unknown = {}) {
  return { response: { status, data } };
}

const EMAIL_FIELD = 'Buscar usuario por correo';

function emailInput() {
  return screen.getByLabelText(EMAIL_FIELD);
}

async function renderAdminPage() {
  render(<MiembrosOrganizacion />);
  await screen.findByText('user1@x.com');
}

describe('MiembrosOrganizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActiveContext.mockReturnValue(orgContext('admin'));
    mocks.getInvitations.mockResolvedValue(paginated([invitation(1)]));
    mocks.inviteMember.mockResolvedValue({ data: invitation(2, { email: 'ana@x.com' }) });
    mocks.revokeInvitation.mockResolvedValue({ data: invitation(1, { status: 'cancelled', can_be_revoked: false }) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('access', () => {
    it('WS2: personal context shows the select-an-organization notice and sends no request', () => {
      mocks.useActiveContext.mockReturnValue(PERSONAL);

      render(<MiembrosOrganizacion />);

      expect(screen.getByText('Selecciona una organización para invitar miembros.')).toBeInTheDocument();
      expect(screen.queryByLabelText(EMAIL_FIELD)).not.toBeInTheDocument();
      expect(mocks.getInvitations).not.toHaveBeenCalled();
    });

    it('WS3: a member sees the member view, no form and no list request', () => {
      mocks.useActiveContext.mockReturnValue(orgContext('member'));

      render(<MiembrosOrganizacion />);

      expect(screen.getByText('Vista de miembro')).toBeInTheDocument();
      expect(
        screen.getByText('Eres miembro de esta organización. Solo el administrador puede invitar o quitar miembros.'),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(EMAIL_FIELD)).not.toBeInTheDocument();
      expect(mocks.getInvitations).not.toHaveBeenCalled();
    });

    it('WS4: an admin gets the form and the list requested for the organization id', async () => {
      await renderAdminPage();

      expect(emailInput()).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Invitaciones' })).toBeInTheDocument();
      expect(mocks.getInvitations).toHaveBeenCalledWith(7, 1);
      expect(screen.getByText('1 pendientes · 1 en total')).toBeInTheDocument();
    });

    it('WS5: a cached admin whose list answers 403 gets the member view', async () => {
      mocks.getInvitations.mockRejectedValue(apiError(403, { message: 'No autorizado' }));

      render(<MiembrosOrganizacion />);

      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
      expect(screen.queryByLabelText(EMAIL_FIELD)).not.toBeInTheDocument();
    });

    it('WS6: a submit answering 403 replaces the form and the list with the member view', async () => {
      const user = userEvent.setup();
      mocks.inviteMember.mockRejectedValue(apiError(403, { message: 'No autorizado' }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
      expect(screen.queryByLabelText(EMAIL_FIELD)).not.toBeInTheDocument();
      expect(screen.queryByText('user1@x.com')).not.toBeInTheDocument();
    });

    it('WS10: switching from an admin organization to a member one shows the member view and no stale list', async () => {
      const view = render(<MiembrosOrganizacion />);
      await screen.findByText('user1@x.com');

      mocks.useActiveContext.mockReturnValue(orgContext('member', 8, 'Beta Ltda.'));
      view.rerender(<MiembrosOrganizacion />);

      expect(screen.getByText('Vista de miembro')).toBeInTheDocument();
      expect(screen.queryByText('user1@x.com')).not.toBeInTheDocument();
    });
  });

  describe('invite', () => {
    it('WS12: a blank email sends no request and explains why', async () => {
      const user = userEvent.setup();
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo');
      expect(screen.getByRole('alert')).toHaveTextContent('Escribe el correo del cliente que quieres invitar.');
      expect(mocks.inviteMember).not.toHaveBeenCalled();
    });

    it('WS13: a malformed email sends no request and explains why', async () => {
      const user = userEvent.setup();
      await renderAdminPage();

      await user.type(emailInput(), 'abc');
      await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo');
      expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo válido.');
      expect(mocks.inviteMember).not.toHaveBeenCalled();
    });

    it('WS14: the trimmed email is sent, by button and by the Enter key', async () => {
      const user = userEvent.setup();
      await renderAdminPage();

      await user.type(emailInput(), '  ana@x.com ');
      await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));
      await waitFor(() => expect(mocks.inviteMember).toHaveBeenCalledWith(7, 'ana@x.com'));

      await user.type(emailInput(), ' luis@x.com {Enter}');
      await waitFor(() => expect(mocks.inviteMember).toHaveBeenLastCalledWith(7, 'luis@x.com'));
    });

    it('WS15: while the request is in flight the button is disabled and a second Enter sends nothing', async () => {
      const user = userEvent.setup();
      let resolveInvite: (value: unknown) => void = () => {};
      mocks.inviteMember.mockReturnValue(new Promise((resolve) => (resolveInvite = resolve)));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');
      expect(await screen.findByRole('button', { name: 'Enviando...' })).toBeDisabled();
      await user.type(emailInput(), '{Enter}');

      expect(mocks.inviteMember).toHaveBeenCalledTimes(1);
      await act(async () => resolveInvite({ data: invitation(2) }));
    });

    it('WS16: a 201 shows the success notice and toast, clears the input and reloads page 1', async () => {
      const user = userEvent.setup();
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      expect(await screen.findByText('Invitación enviada a ana@x.com')).toBeInTheDocument();
      expect(screen.getByText('Invitación enviada')).toBeInTheDocument();
      expect(
        screen.getByText('Le avisamos a ana@x.com en su cuenta de cliente. Aparecerá en su bandeja de invitaciones.'),
      ).toBeInTheDocument();
      expect(emailInput()).toHaveValue('');
      await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledTimes(2));
      expect(mocks.getInvitations).toHaveBeenLastCalledWith(7, 1);
    });

    it('WS17/WS22: a 422 renders the server text verbatim under the refusal title and keeps the input', async () => {
      const user = userEvent.setup();
      const message = 'Este usuario ya es miembro de tu organización';
      mocks.inviteMember.mockRejectedValue(apiError(422, { message, errors: { email: [message] } }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No puedes invitar a este correo');
      expect(alert).toHaveTextContent(message);
      expect(emailInput()).toHaveValue('ana@x.com');
    });

    it('WS18: a 422 on the organization key renders that text', async () => {
      const user = userEvent.setup();
      const message = 'La organización seleccionada no está activa.';
      mocks.inviteMember.mockRejectedValue(apiError(422, { message, errors: { organization: [message] } }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(emailInput()).toBeEnabled();
    });

    it('WS19: a 429 renders the server text and leaves the form usable', async () => {
      const user = userEvent.setup();
      const message = 'Enviaste demasiadas invitaciones. Intenta de nuevo en un minuto.';
      mocks.inviteMember.mockRejectedValue(apiError(429, { message }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeEnabled();
    });

    it('WS20: a network error or 5xx renders the generic send error', async () => {
      const user = userEvent.setup();
      mocks.inviteMember.mockRejectedValue(apiError(500, { message: 'Server Error' }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo enviar la invitación. Intenta nuevamente.');
      expect(alert).not.toHaveTextContent('Server Error');
    });

    it('WS21: editing the input dismisses a server notice and a client notice', async () => {
      const user = userEvent.setup();
      mocks.inviteMember.mockRejectedValue(apiError(422, { message: 'Texto', errors: { email: ['Texto'] } }));
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');
      await screen.findByRole('alert');
      await user.type(emailInput(), 'm');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.clear(emailInput());
      await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      await user.type(emailInput(), 'a');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('the toast is cleared by a 5000 ms timer', async () => {
      const user = userEvent.setup();
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      await renderAdminPage();

      await user.type(emailInput(), 'ana@x.com{Enter}');
      await screen.findByText('Invitación enviada a ana@x.com');

      const call = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 5000);
      expect(call).toBeDefined();
      act(() => (call?.[0] as () => void)());
      expect(screen.queryByText('Invitación enviada a ana@x.com')).not.toBeInTheDocument();
    });
  });

  describe('revoke', () => {
    it('WS36/WS41: a single click revokes, shows the toast, reloads the same page and drops the button', async () => {
      const user = userEvent.setup();
      mocks.getInvitations.mockResolvedValueOnce(paginated([invitation(1)], { last_page: 2, total: 21, pending_count: 21 }));
      await renderAdminPage();
      mocks.getInvitations.mockResolvedValueOnce(
        paginated([invitation(3)], { current_page: 2, last_page: 2, total: 21, pending_count: 21 }),
      );
      await user.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByText('user3@x.com');
      mocks.getInvitations.mockResolvedValue(
        paginated([invitation(3, { status: 'cancelled', can_be_revoked: false })], {
          current_page: 2,
          last_page: 2,
          total: 21,
          pending_count: 20,
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Revocar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByText('Invitación revocada')).toBeInTheDocument();
      expect(mocks.revokeInvitation).toHaveBeenCalledWith(7, 3);
      await waitFor(() => expect(mocks.getInvitations).toHaveBeenLastCalledWith(7, 2));
      const row = await screen.findByText('Cancelada');
      expect(within(row.closest('li') as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    });

    it('WS37: a 409 shows the server message and reloads the list', async () => {
      const user = userEvent.setup();
      mocks.revokeInvitation.mockRejectedValue(apiError(409, { message: 'Esta invitación ya no está disponible' }));
      await renderAdminPage();
      mocks.getInvitations.mockClear();

      await user.click(screen.getByRole('button', { name: 'Revocar' }));

      expect(await screen.findByText('Esta invitación ya no está disponible')).toBeInTheDocument();
      await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledTimes(1));
    });

    it('WS38: a 404 shows the server message and reloads the list', async () => {
      const user = userEvent.setup();
      mocks.revokeInvitation.mockRejectedValue(apiError(404, { message: 'Invitación no encontrada' }));
      await renderAdminPage();
      mocks.getInvitations.mockClear();

      await user.click(screen.getByRole('button', { name: 'Revocar' }));

      expect(await screen.findByText('Invitación no encontrada')).toBeInTheDocument();
      await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledTimes(1));
    });

    it('WS39: a 403 on revoke shows the member view', async () => {
      const user = userEvent.setup();
      mocks.revokeInvitation.mockRejectedValue(apiError(403, { message: 'No autorizado' }));
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'Revocar' }));

      expect(await screen.findByText('Vista de miembro')).toBeInTheDocument();
    });

    it('WS40: a 5xx shows the generic revoke error and the row stays usable', async () => {
      const user = userEvent.setup();
      mocks.revokeInvitation.mockRejectedValue(apiError(500, { message: 'Server Error' }));
      await renderAdminPage();

      await user.click(screen.getByRole('button', { name: 'Revocar' }));

      expect(await screen.findByText('No se pudo revocar la invitación. Intenta nuevamente.')).toBeInTheDocument();
      expect(screen.queryByText('Server Error')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Revocar' })).toBeEnabled();
    });
  });
});
