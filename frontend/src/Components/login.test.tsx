import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLoginRequest = vi.hoisted(() => vi.fn());
const mockAuthLogin = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());
const routerState = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/login', state: routerState.current }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('../services/auth', () => ({
  login: mockLoginRequest,
}));

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ login: mockAuthLogin, logout: mockLogout }),
}));

import Login from './login';

async function submitLoginAs(role: string) {
  mockLoginRequest.mockResolvedValue({ data: { token: 't', user: { id: 1, role } } });

  render(<Login />);
  fireEvent.change(screen.getByPlaceholderText('user@gmail.com'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByPlaceholderText('************'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
}

describe('Login return after reserve (RB-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.current = null;
  });

  it('returns a tenant to the safe internal path in state.from, replacing the login entry', async () => {
    routerState.current = { from: '/leodega/7', reason: 'reserve' };

    await submitLoginAs('tenant');

    expect(mockNavigate).toHaveBeenCalledWith('/leodega/7', { replace: true });
  });

  it('returns a different tenant to a different safe path (no hardcoded target)', async () => {
    routerState.current = { from: '/leodega/42', reason: 'reserve' };

    await submitLoginAs('tenant');

    expect(mockNavigate).toHaveBeenCalledWith('/leodega/42', { replace: true });
  });

  it.each([
    ['absolute https URL', 'https://evil.example'],
    ['protocol-relative URL', '//evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['backslash trick', '/\\evil.example'],
  ])('ignores an unsafe state.from (%s) and uses the tenant dashboard', async (_label, from) => {
    routerState.current = { from, reason: 'reserve' };

    await submitLoginAs('tenant');

    expect(mockNavigate).toHaveBeenCalledWith('/arrendatario/dashboard');
    expect(mockNavigate).not.toHaveBeenCalledWith(from, expect.anything());
    expect(mockNavigate).not.toHaveBeenCalledWith(from);
  });

  it('ignores a non-string state.from', async () => {
    routerState.current = { from: { path: '/leodega/7' } };

    await submitLoginAs('tenant');

    expect(mockNavigate).toHaveBeenCalledWith('/arrendatario/dashboard');
  });

  it('uses the tenant dashboard when /login was opened directly (no router state)', async () => {
    routerState.current = null;

    await submitLoginAs('tenant');

    expect(mockNavigate).toHaveBeenCalledWith('/arrendatario/dashboard');
  });

  it('keeps the role redirect for a landlord even with a safe state.from', async () => {
    routerState.current = { from: '/leodega/7', reason: 'reserve' };

    await submitLoginAs('landlord');

    expect(mockNavigate).toHaveBeenCalledWith('/arrendador/bodegas');
  });

  it('keeps the role redirect for an admin even with a safe state.from', async () => {
    routerState.current = { from: '/leodega/7', reason: 'reserve' };

    await submitLoginAs('admin');

    expect(mockNavigate).toHaveBeenCalledWith('/admin/resumen');
  });
});

describe('Login required notice (RB-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerState.current = null;
  });

  it('shows the ERS notice when the visitor was sent here by Reservar', () => {
    routerState.current = { from: '/leodega/7', reason: 'reserve' };

    render(<Login />);

    expect(screen.getByText('Debes iniciar sesión para hacer una reserva')).toBeInTheDocument();
  });

  it('shows no notice when /login is opened directly', () => {
    render(<Login />);

    expect(screen.queryByText('Debes iniciar sesión para hacer una reserva')).not.toBeInTheDocument();
  });

  it('shows no notice for a different reason code', () => {
    routerState.current = { from: '/leodega/7', reason: 'other' };

    render(<Login />);

    expect(screen.queryByText('Debes iniciar sesión para hacer una reserva')).not.toBeInTheDocument();
  });
});
