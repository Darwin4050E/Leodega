import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Organization } from '../services/organizations';
import type { ActiveContextValue } from '../context/activeContextBase';

const mockUseActiveContext = vi.hoisted(() => vi.fn());
vi.mock('../context/useActiveContext', () => ({ useActiveContext: mockUseActiveContext }));

const mockGetOrganizationWallet = vi.hoisted(() => vi.fn());
vi.mock('../services/organizations', () => ({ getOrganizationWallet: mockGetOrganizationWallet }));

import ActiveContextRibbon from './ActiveContextRibbon';

const andina: Organization = {
  id: 7,
  name: 'Importadora Andina S.A.',
  ruc: '1790012345001',
  email: 'ops@andina.test',
  logo: null,
  status: 'active',
  role: 'admin',
};

const norte: Organization = {
  id: 8,
  name: 'Norte Cía. Ltda.',
  ruc: '1790012346001',
  email: 'ops@norte.test',
  logo: null,
  status: 'active',
  role: 'member',
};

function setContext(overrides: Partial<ActiveContextValue> = {}) {
  mockUseActiveContext.mockReturnValue({
    context: { kind: 'personal' },
    activeOrganization: null,
    organizations: [],
    status: 'ready',
    enabled: true,
    selectOrganization: vi.fn(),
    selectPersonal: vi.fn(),
    activateOrganization: vi.fn(),
    reloadOrganizations: vi.fn(),
    ...overrides,
  } satisfies ActiveContextValue);
}

const withRouter = () => (
  <MemoryRouter>
    <ActiveContextRibbon />
  </MemoryRouter>
);

describe('ActiveContextRibbon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizationWallet.mockResolvedValue({ data: { organization_id: 7, balance: '80.50' } });
  });

  it('announces the organization the tenant is operating as', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina],
    });

    render(withRouter());

    const ribbon = screen.getByRole('status');
    expect(ribbon).toHaveTextContent('Estás operando como Importadora Andina S.A.');
    expect(ribbon).toHaveClass('bg-leodega-50', 'border-b', 'border-leodega-200', 'text-leodega-700');
  });

  it('disappears without a reload when the tenant goes back to personal mode', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina],
    });
    const { container, rerender } = render(withRouter());
    expect(screen.getByRole('status')).toHaveTextContent('Estás operando como Importadora Andina S.A.');

    setContext();
    rerender(withRouter());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('follows the organization when the tenant switches to another one', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina, norte],
    });
    const { rerender } = render(withRouter());

    setContext({
      context: { kind: 'organization', organizationId: 8 },
      activeOrganization: norte,
      organizations: [andina, norte],
    });
    rerender(withRouter());

    expect(screen.getByRole('status')).toHaveTextContent('Estás operando como Norte Cía. Ltda.');
    expect(screen.getByRole('status')).not.toHaveTextContent('Importadora Andina');
  });

  it('renders nothing in personal mode', () => {
    setContext();

    const { container } = render(withRouter());

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the active organization is not resolved yet', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: null,
      status: 'loading',
    });

    const { container } = render(withRouter());

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a session that is not a tenant', () => {
    setContext({
      enabled: false,
      status: 'idle',
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
    });

    const { container } = render(withRouter());

    expect(container).toBeEmptyDOMElement();
  });

  it('OW-WS1: shows the wallet balance chip next to the unchanged operating text', async () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina],
    });

    render(withRouter());

    const chip = await screen.findByRole('link', { name: /Saldo/ });
    expect(chip).toHaveTextContent('$80.50');
    expect(chip).toHaveAttribute('href', '/organizacion/billetera');
    expect(screen.getByRole('status')).toHaveTextContent('Estás operando como Importadora Andina S.A.');
    expect(mockGetOrganizationWallet).toHaveBeenCalledWith(7);
  });

  it('shows the chip to a plain member too', async () => {
    setContext({
      context: { kind: 'organization', organizationId: 8 },
      activeOrganization: norte,
      organizations: [norte],
    });
    mockGetOrganizationWallet.mockResolvedValue({ data: { organization_id: 8, balance: '12.00' } });

    render(withRouter());

    expect(await screen.findByRole('link', { name: /Saldo/ })).toHaveTextContent('$12.00');
  });

  it('OW-WS2: issues no wallet request and shows no chip in personal mode or while unresolved', async () => {
    setContext();
    const personal = render(withRouter());
    personal.unmount();

    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: null,
      status: 'loading',
    });
    render(withRouter());

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
    expect(mockGetOrganizationWallet).not.toHaveBeenCalled();
  });
});
