import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsuariosAdmin from './UsuariosAdmin';

const mockGetUsers = vi.hoisted(() => vi.fn());
const mockBlockUser = vi.hoisted(() => vi.fn());
const mockReactivateUser = vi.hoisted(() => vi.fn());

vi.mock('../services/users', () => ({
  getUsers: mockGetUsers,
  blockUser: mockBlockUser,
  reactivateUser: mockReactivateUser,
}));

const sampleUsers = [
  { id: 1, name: 'Juan', lastname: 'Pérez', email: 'juan@test.com', role: 'tenant', state: 'active' },
  { id: 2, name: 'Ada', lastname: 'López', email: 'ada@test.com', role: 'landlord', state: 'blocked' },
];

describe('UsuariosAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue({ data: sampleUsers });
    mockBlockUser.mockResolvedValue({ data: {} });
    mockReactivateUser.mockResolvedValue({ data: {} });
  });

  it('lists users with their state label', async () => {
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());
    expect(screen.getByText('Activo', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Bloqueado', { selector: 'span' })).toBeInTheDocument();
  });

  it('keeps the block confirm disabled until a non-whitespace reason is typed', async () => {
    const user = userEvent.setup();
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bloquear' }));

    const dialog = screen.getByText('Bloquear cuenta').closest('div') as HTMLElement;
    const confirm = within(dialog).getByRole('button', { name: 'Bloquear' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Motivo'), '    ');
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByLabelText('Motivo'));
    await user.type(screen.getByLabelText('Motivo'), 'Actividad fraudulenta');
    expect(confirm).toBeEnabled();
  });

  it('requires at least 5 characters in the block reason', async () => {
    const user = userEvent.setup();
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bloquear' }));

    const dialog = screen.getByText('Bloquear cuenta').closest('div') as HTMLElement;
    const confirm = within(dialog).getByRole('button', { name: 'Bloquear' });

    await user.type(screen.getByLabelText('Motivo'), 'abcd');
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Mínimo 5 caracteres.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Motivo'), 'e');
    expect(confirm).toBeEnabled();
    expect(screen.queryByText('Mínimo 5 caracteres.')).not.toBeInTheDocument();
  });

  it('calls blockUser with the typed reason on confirm', async () => {
    const user = userEvent.setup();
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bloquear' }));
    await user.type(screen.getByLabelText('Motivo'), 'Actividad fraudulenta');

    const dialog = screen.getByText('Bloquear cuenta').closest('div') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }));

    expect(mockBlockUser).toHaveBeenCalledWith(1, 'Actividad fraudulenta');
  });

  it('calls reactivateUser for a blocked user', async () => {
    const user = userEvent.setup();
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Ada López')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Reactivar' }));

    const dialog = screen.getByText('Reactivar cuenta').closest('div') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    await waitFor(() => expect(mockReactivateUser).toHaveBeenCalledWith(2));
  });

  it('shows a notice when block returns HTTP 409', async () => {
    const user = userEvent.setup();
    mockBlockUser.mockRejectedValue({ response: { status: 409, data: { message: 'La cuenta ya está bloqueada' } } });
    render(<UsuariosAdmin />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Bloquear' }));
    await user.type(screen.getByLabelText('Motivo'), 'Actividad fraudulenta');
    const dialog = screen.getByText('Bloquear cuenta').closest('div') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/ya estaba bloqueada/i));
  });
});
