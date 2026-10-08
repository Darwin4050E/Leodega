import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Organization } from '../services/organizations';
import type { ActiveContextValue } from '../context/activeContextBase';

const mockUseActiveContext = vi.hoisted(() => vi.fn());
vi.mock('../context/useActiveContext', () => ({ useActiveContext: mockUseActiveContext }));

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

describe('ActiveContextRibbon', () => {
  beforeEach(() => vi.clearAllMocks());

  it('announces the organization the tenant is operating as', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina],
    });

    render(<ActiveContextRibbon />);

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
    const { container, rerender } = render(<ActiveContextRibbon />);
    expect(screen.getByRole('status')).toHaveTextContent('Estás operando como Importadora Andina S.A.');

    setContext();
    rerender(<ActiveContextRibbon />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('follows the organization when the tenant switches to another one', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
      organizations: [andina, norte],
    });
    const { rerender } = render(<ActiveContextRibbon />);

    setContext({
      context: { kind: 'organization', organizationId: 8 },
      activeOrganization: norte,
      organizations: [andina, norte],
    });
    rerender(<ActiveContextRibbon />);

    expect(screen.getByRole('status')).toHaveTextContent('Estás operando como Norte Cía. Ltda.');
    expect(screen.getByRole('status')).not.toHaveTextContent('Importadora Andina');
  });

  it('renders nothing in personal mode', () => {
    setContext();

    const { container } = render(<ActiveContextRibbon />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the active organization is not resolved yet', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: null,
      status: 'loading',
    });

    const { container } = render(<ActiveContextRibbon />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a session that is not a tenant', () => {
    setContext({
      enabled: false,
      status: 'idle',
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: andina,
    });

    const { container } = render(<ActiveContextRibbon />);

    expect(container).toBeEmptyDOMElement();
  });
});
