import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockGetOrganizationWallet = vi.hoisted(() => vi.fn());
const mockGetWalletMovements = vi.hoisted(() => vi.fn());
const mockUseActiveContext = vi.hoisted(() => vi.fn());

vi.mock('../../services/organizations', () => ({
  getOrganizationWallet: mockGetOrganizationWallet,
  getWalletMovements: mockGetWalletMovements,
}));
vi.mock('../../context/useActiveContext', () => ({ useActiveContext: mockUseActiveContext }));
vi.mock('../../Components/HeaderTendant', () => ({ default: () => <div data-testid="header-tendant" /> }));
vi.mock('../../Components/WalletTopUpModal', () => ({
  default: ({ organizationId, onClose }: { organizationId: number; onClose: () => void }) => (
    <div data-testid="top-up-modal">
      <span>{`top-up-for-${organizationId}`}</span>
      <button onClick={onClose}>close-top-up</button>
    </div>
  ),
}));

import BilleteraOrganizacion from './BilleteraOrganizacion';
import { notifyWalletChanged } from '../../utils/walletEvents';

function orgContext(role: 'admin' | 'member', id = 7) {
  return {
    context: { kind: 'organization', organizationId: id },
    activeOrganization: { id, name: 'Acme S.A.', role },
    enabled: true,
  };
}

const PERSONAL = { context: { kind: 'personal' }, activeOrganization: null, enabled: true };

function movement(overrides = {}) {
  return {
    id: 1,
    type: 'recarga',
    amount: '100.00',
    balance_after: '180.50',
    reservation_id: null,
    actor_name: 'Ana Pérez',
    created_at: '2026-10-09T15:00:00.000000Z',
    ...overrides,
  };
}

const MOVEMENTS = [
  movement({ id: 3, type: 'reembolso', amount: '30.00', balance_after: '180.50', reservation_id: 12 }),
  movement({ id: 2, type: 'reserva', amount: '-49.50', balance_after: '150.50', reservation_id: 12 }),
  movement({ id: 1, type: 'recarga', amount: '200.00', balance_after: '200.00' }),
];

describe('BilleteraOrganizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActiveContext.mockReturnValue(orgContext('admin'));
    mockGetOrganizationWallet.mockResolvedValue({ data: { organization_id: 7, balance: '180.50' } });
    mockGetWalletMovements.mockResolvedValue({ data: MOVEMENTS });
  });

  it('shows the balance and one row per movement with its label, signed amount and balance after', async () => {
    render(<BilleteraOrganizacion />);

    const rows = await screen.findAllByRole('row');
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('$180.50');
    expect(mockGetWalletMovements).toHaveBeenCalledWith(7);
    const body = rows.slice(1);
    expect(body).toHaveLength(3);
    expect(within(body[0]).getByText('Reembolso')).toBeInTheDocument();
    expect(body[0]).toHaveTextContent('+$30.00');
    expect(within(body[1]).getByText('Reserva')).toBeInTheDocument();
    expect(body[1]).toHaveTextContent('-$49.50');
    expect(body[1]).toHaveTextContent('$150.50');
    expect(within(body[2]).getByText('Recarga')).toBeInTheDocument();
    expect(body[2]).toHaveTextContent('+$200.00');
  });

  it('OW-WS4: an admin sees the Movimientos heading and the Recargar saldo control', async () => {
    render(<BilleteraOrganizacion />);

    expect(await screen.findByRole('heading', { name: 'Movimientos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar saldo' })).toBeInTheDocument();
  });

  it('OW-WS5: a member sees Mis movimientos and no top-up control or hint', async () => {
    mockUseActiveContext.mockReturnValue(orgContext('member'));

    render(<BilleteraOrganizacion />);

    expect(await screen.findByRole('heading', { name: 'Mis movimientos' })).toBeInTheDocument();
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('$180.50');
    expect(screen.queryByRole('button', { name: 'Recargar saldo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pide a un administrador/)).not.toBeInTheDocument();
  });

  it('opens the top-up modal for the active organization and closes it again', async () => {
    render(<BilleteraOrganizacion />);

    fireEvent.click(await screen.findByRole('button', { name: 'Recargar saldo' }));
    expect(screen.getByText('top-up-for-7')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-top-up'));
    expect(screen.queryByTestId('top-up-modal')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no movements', async () => {
    mockGetWalletMovements.mockResolvedValue({ data: [] });

    render(<BilleteraOrganizacion />);

    expect(await screen.findByText('Aún no hay movimientos.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error message when the movements request fails, keeping the balance', async () => {
    mockGetWalletMovements.mockRejectedValue({ response: { status: 500, data: {} } });

    render(<BilleteraOrganizacion />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los movimientos.');
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('$180.50');
  });

  it('OW-WS7: reloads the movements and the balance when a wallet change is announced', async () => {
    render(<BilleteraOrganizacion />);
    await screen.findAllByRole('row');
    mockGetOrganizationWallet.mockResolvedValue({ data: { organization_id: 7, balance: '280.50' } });
    mockGetWalletMovements.mockResolvedValue({
      data: [movement({ id: 4, amount: '100.00', balance_after: '280.50' }), ...MOVEMENTS],
    });

    act(() => notifyWalletChanged());

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5));
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent('$280.50');
  });

  it('OW-WS16: discards movements that arrive late for a previous organization', async () => {
    let resolveFirst: (value: { data: unknown[] }) => void = () => {};
    mockGetWalletMovements
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [movement({ id: 9, type: 'recarga', amount: '20.00', balance_after: '20.00' })] });
    const view = render(<BilleteraOrganizacion />);

    mockUseActiveContext.mockReturnValue(orgContext('admin', 8));
    view.rerender(<BilleteraOrganizacion />);
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    await act(async () => resolveFirst({ data: MOVEMENTS }));

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(mockGetWalletMovements).toHaveBeenLastCalledWith(8);
  });

  it('OW-WS3: personal mode asks to pick an organization and issues no wallet request', () => {
    mockUseActiveContext.mockReturnValue(PERSONAL);

    render(<BilleteraOrganizacion />);

    expect(screen.getByText('Selecciona una organización para ver su billetera.')).toBeInTheDocument();
    expect(mockGetOrganizationWallet).not.toHaveBeenCalled();
    expect(mockGetWalletMovements).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Recargar saldo' })).not.toBeInTheDocument();
  });
});
