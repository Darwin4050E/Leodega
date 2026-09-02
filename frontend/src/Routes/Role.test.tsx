import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Role from './Role';

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../context/useAuth', () => ({
  useAuth: mockUseAuth,
}));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin/usuarios']}>
      <Routes>
        <Route element={<Role allowed={['admin']} />}>
          <Route path="/admin/usuarios" element={<div>Panel de usuarios</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Role guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no authenticated session', () => {
    mockUseAuth.mockReturnValue({ token: null, user: null });
    renderGuarded();
    expect(screen.queryByText('Panel de usuarios')).not.toBeInTheDocument();
  });

  it('keeps a non-admin user out of the guarded content', () => {
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'tenant' } });
    renderGuarded();
    expect(screen.queryByText('Panel de usuarios')).not.toBeInTheDocument();
    expect(screen.getByText(/No tienes permisos/i)).toBeInTheDocument();
  });

  it('renders the guarded content for an admin user', () => {
    mockUseAuth.mockReturnValue({ token: 'tok', user: { role: 'admin' } });
    renderGuarded();
    expect(screen.getByText('Panel de usuarios')).toBeInTheDocument();
  });
});
