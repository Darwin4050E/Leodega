import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Organization } from '../services/organizations';
import type { ActiveContextValue } from '../context/activeContextBase';

const mockUseActiveContext = vi.hoisted(() => vi.fn());
vi.mock('../context/useActiveContext', () => ({ useActiveContext: mockUseActiveContext }));

import ContextSwitcher from './ContextSwitcher';

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
  logo: 'https://cdn.test/norte.png',
  status: 'active',
  role: 'member',
};

const selectOrganization = vi.fn();
const selectPersonal = vi.fn();
const reloadOrganizations = vi.fn();

function setContext(overrides: Partial<ActiveContextValue> = {}) {
  mockUseActiveContext.mockReturnValue({
    context: { kind: 'personal' },
    activeOrganization: null,
    organizations: [andina, norte],
    status: 'ready',
    enabled: true,
    selectOrganization,
    selectPersonal,
    activateOrganization: vi.fn(),
    reloadOrganizations,
    ...overrides,
  } satisfies ActiveContextValue);
}

function renderSwitcher(placement: 'header' | 'drawer' = 'header') {
  return render(
    <MemoryRouter>
      <div>
        <ContextSwitcher placement={placement} />
        <button type="button">fuera</button>
      </div>
    </MemoryRouter>,
  );
}

const panel = () => screen.getByRole('group', { name: 'Cambiar contexto' });

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('context-switcher-trigger'));
  return user;
}

describe('ContextSwitcher visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setContext();
  });

  it('renders nothing when the context is not enabled', () => {
    setContext({ enabled: false, status: 'idle', organizations: [] });

    renderSwitcher();

    expect(screen.queryByTestId('context-switcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('context-switcher-trigger')).not.toBeInTheDocument();
  });

  it('renders a collapsed trigger when enabled', () => {
    renderSwitcher();

    expect(screen.getByTestId('context-switcher-trigger')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });

  it.each(['header', 'drawer'] as const)('exposes the %s placement', (placement) => {
    renderSwitcher(placement);

    expect(screen.getByTestId('context-switcher')).toHaveAttribute('data-placement', placement);
  });
});

describe('ContextSwitcher trigger label', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads Modo personal in personal mode', () => {
    setContext();
    renderSwitcher();

    expect(screen.getByTestId('context-switcher-trigger')).toHaveTextContent('Modo personal');
  });

  it('shows the short organization name when an organization is active', () => {
    setContext({ context: { kind: 'organization', organizationId: 7 }, activeOrganization: andina });
    renderSwitcher();

    expect(screen.getByTestId('context-switcher-trigger')).toHaveTextContent('Importadora Andina');
    expect(screen.getByTestId('context-switcher-trigger')).not.toHaveTextContent('S.A.');
  });

  it('shows Cargando… while the active organization is not resolved yet', () => {
    setContext({
      context: { kind: 'organization', organizationId: 7 },
      activeOrganization: null,
      status: 'loading',
      organizations: [],
    });
    renderSwitcher();

    expect(screen.getByTestId('context-switcher-trigger')).toHaveTextContent('Cargando…');
  });
});

describe('ContextSwitcher panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setContext();
  });

  it('opens a labelled panel linked to the trigger', async () => {
    renderSwitcher();

    await open();

    const button = screen.getByTestId('context-switcher-trigger');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', panel().id);
  });

  it('lists personal mode first and then every organization with its role', async () => {
    renderSwitcher();
    await open();

    const rows = within(panel()).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Modo personal');
    expect(rows[1]).toHaveTextContent('Importadora Andina S.A.');
    expect(rows[1]).toHaveTextContent('Eres administrador');
    expect(rows[2]).toHaveTextContent('Norte Cía. Ltda.');
    expect(rows[2]).toHaveTextContent('Miembro');
  });

  it('shows the logo when there is one and the initials otherwise', async () => {
    renderSwitcher();
    await open();

    expect(screen.getByRole('img', { name: 'Logo de Norte Cía. Ltda.' })).toHaveAttribute(
      'src',
      'https://cdn.test/norte.png',
    );
    expect(screen.queryByRole('img', { name: 'Logo de Importadora Andina S.A.' })).not.toBeInTheDocument();
    expect(within(panel()).getByText('IA')).toBeInTheDocument();
  });

  it('marks personal as the current row in personal mode', async () => {
    renderSwitcher();
    await open();

    const rows = within(panel()).getAllByRole('button');
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[1]).not.toHaveAttribute('aria-current');
    expect(rows[2]).not.toHaveAttribute('aria-current');
  });

  it('marks the active organization row as current', async () => {
    setContext({ context: { kind: 'organization', organizationId: 8 }, activeOrganization: norte });
    renderSwitcher();
    await open();

    const rows = within(panel()).getAllByRole('button');
    expect(rows[0]).not.toHaveAttribute('aria-current');
    expect(rows[2]).toHaveAttribute('aria-current', 'true');
  });

  it('ends with the Crear organización link below the list', async () => {
    renderSwitcher();
    await open();

    const link = within(panel()).getByRole('link', { name: 'Crear organización' });
    expect(link).toHaveAttribute('href', '/mi-cuenta/crear-organizacion');
    const rows = within(panel()).getAllByRole('button');
    expect(rows.at(-1)!.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps personal mode and the create link available when the tenant has no organizations', async () => {
    setContext({ organizations: [] });
    renderSwitcher();
    await open();

    expect(within(panel()).getAllByRole('button')).toHaveLength(1);
    expect(within(panel()).getByRole('link', { name: 'Crear organización' })).toBeInTheDocument();
  });
});

describe('ContextSwitcher selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setContext();
  });

  it('selects the organization and closes the panel', async () => {
    renderSwitcher();
    const user = await open();

    await user.click(within(panel()).getByRole('button', { name: /Norte Cía\. Ltda\./ }));

    expect(selectOrganization).toHaveBeenCalledWith(8);
    expect(selectPersonal).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });

  it('selects personal mode and closes the panel', async () => {
    setContext({ context: { kind: 'organization', organizationId: 7 }, activeOrganization: andina });
    renderSwitcher();
    const user = await open();

    await user.click(within(panel()).getByRole('button', { name: /Modo personal/ }));

    expect(selectPersonal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });
});

describe('ContextSwitcher dismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setContext();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    renderSwitcher();
    const user = await open();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
    expect(screen.getByTestId('context-switcher-trigger')).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    renderSwitcher();
    const user = await open();

    await user.click(screen.getByRole('button', { name: 'fuera' }));

    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });

  it('stays open when the click lands inside the panel but not on an action', async () => {
    renderSwitcher();
    const user = await open();

    await user.click(panel());

    expect(panel()).toBeInTheDocument();
  });

  it('closes when the create organization link is followed', async () => {
    renderSwitcher();
    const user = await open();

    await user.click(within(panel()).getByRole('link', { name: 'Crear organización' }));

    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });

  it('toggles closed when the trigger is clicked again', async () => {
    renderSwitcher();
    const user = await open();

    await user.click(screen.getByTestId('context-switcher-trigger'));

    expect(screen.queryByRole('group', { name: 'Cambiar contexto' })).not.toBeInTheDocument();
  });
});

describe('ContextSwitcher list states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading note while the list loads and keeps the other rows usable', async () => {
    setContext({ status: 'loading', organizations: [] });
    renderSwitcher();
    await open();

    expect(within(panel()).getByText('Cargando organizaciones…')).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: /Modo personal/ })).toBeInTheDocument();
  });

  it('shows the error with a retry that reloads the list', async () => {
    setContext({ status: 'error', organizations: [] });
    renderSwitcher();
    const user = await open();

    expect(within(panel()).getByText('No pudimos cargar tus organizaciones')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'Reintentar' }));

    expect(reloadOrganizations).toHaveBeenCalledTimes(1);
  });

  it('does not show loading or error notes when the list is ready', async () => {
    setContext();
    renderSwitcher();
    await open();

    expect(screen.queryByText('Cargando organizaciones…')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar tus organizaciones')).not.toBeInTheDocument();
  });
});
