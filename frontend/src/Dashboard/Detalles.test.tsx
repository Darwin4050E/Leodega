import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../context/useAuth', () => ({ useAuth: mockUseAuth }));
vi.mock('./HeaderDashboard', () => ({
  HeaderDashboard: () => <div data-testid="header-dashboard" />,
}));
vi.mock('../Components/HeaderTendant', () => ({
  default: () => <div data-testid="header-tendant" />,
}));
vi.mock('../Components/LeodegaUI', () => ({
  default: () => <div data-testid="leodega-ui" />,
}));

import Detalles from './Detalles';

describe('Detalles header', () => {
  it('uses the tenant header for a tenant', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'tenant' } });
    render(<Detalles />);

    expect(screen.getByTestId('header-tendant')).toBeInTheDocument();
    expect(screen.queryByTestId('header-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('leodega-ui')).toBeInTheDocument();
  });

  it.each([
    ['a visitor', null],
    ['a landlord', { id: 2, role: 'landlord' }],
  ])('keeps the dashboard header for %s', (_label, user) => {
    mockUseAuth.mockReturnValue({ user });
    render(<Detalles />);

    expect(screen.getByTestId('header-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('header-tendant')).not.toBeInTheDocument();
  });
});
