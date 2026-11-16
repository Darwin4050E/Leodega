import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/profile', () => ({
  getProfile: vi.fn().mockResolvedValue({ data: { name: 'Ana', lastname: 'Paz' } }),
}));
vi.mock('../services/notifications', () => ({
  getUnreadNotificationsCount: vi.fn().mockResolvedValue({ data: { count: 0 } }),
}));
vi.mock('./NotificatiosnDropdown', () => ({ default: () => null }));

import { HeaderDashboard } from './HeaderDashboard';

describe('HeaderDashboard role label', () => {
  it('shows "Gestor de bodega" for the landlord', async () => {
    render(<HeaderDashboard role="landlord" />);
    await waitFor(() => screen.getByText(/Ana/));
    expect(screen.getByText('Gestor de bodega')).toBeInTheDocument();
  });

  it('keeps "Administrador" for the admin', async () => {
    render(<HeaderDashboard role="admin" />);
    await waitFor(() => screen.getByText(/Ana/));
    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });
});
