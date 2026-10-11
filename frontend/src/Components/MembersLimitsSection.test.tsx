import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockGetSpendingLimits = vi.hoisted(() => vi.fn());
const mockSetSpendingLimit = vi.hoisted(() => vi.fn());

vi.mock('../services/organizations', () => ({
  getSpendingLimits: mockGetSpendingLimits,
  setSpendingLimit: mockSetSpendingLimit,
}));

import MembersLimitsSection from './MembersLimitsSection';
import { notifyWalletChanged } from '../utils/walletEvents';

function row(overrides = {}) {
  return { user_id: 1, name: 'Ana Pérez', role: 'admin', monthly_limit: '500.00', spent: '120.00', ...overrides };
}

const ADMIN_VIEW = [
  row(),
  row({ user_id: 2, name: 'Luis Mora', role: 'member', monthly_limit: null, spent: '35.50' }),
  row({ user_id: 3, name: 'Eva Ruiz', role: 'member', monthly_limit: '1500.5', spent: '0.00' }),
];

function bodyRows() {
  return screen.getAllByRole('row').slice(1);
}

describe('MembersLimitsSection (view)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSpendingLimits.mockResolvedValue({ data: ADMIN_VIEW });
  });

  it('ML-WS1: shows the title, the column headers and one row per member with limit and consumed', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);

    expect(screen.getByRole('heading', { name: 'Miembros y límites' })).toBeInTheDocument();
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Miembro' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Límite mensual' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Consumido este mes' })).toBeInTheDocument();
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Ana Pérez')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('$500.00');
    expect(rows[0]).toHaveTextContent('$120.00');
    expect(rows[2]).toHaveTextContent('$1,500.50');
    expect(mockGetSpendingLimits).toHaveBeenCalledWith(7);
  });

  it('ML-WS2/WS16: a member sees only the single row the server returns, with limit and consumed', async () => {
    mockGetSpendingLimits.mockResolvedValue({ data: [row({ user_id: 5, name: 'Mía', role: 'member' })] });

    render(<MembersLimitsSection organizationId={7} isAdmin />);

    await screen.findByRole('table');
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('Mía');
    expect(bodyRows()[0]).toHaveTextContent('$500.00');
    expect(bodyRows()[0]).toHaveTextContent('$120.00');
  });

  it('ML-WS17: a member without a limit shows Sin límite and the consumed amount', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);

    await screen.findByRole('table');
    expect(bodyRows()[1]).toHaveTextContent('Sin límite');
    expect(bodyRows()[1]).toHaveTextContent('$35.50');
  });

  it('ML-WS4: shows Cargando miembros… while the request is pending', () => {
    mockGetSpendingLimits.mockReturnValue(new Promise(() => {}));

    render(<MembersLimitsSection organizationId={7} isAdmin />);

    expect(screen.getByText('Cargando miembros…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('ML-WS4: shows No pudimos cargar los miembros when the request fails', async () => {
    mockGetSpendingLimits.mockRejectedValue({ response: { status: 500 } });

    render(<MembersLimitsSection organizationId={7} isAdmin />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los miembros');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Miembros y límites' })).toBeInTheDocument();
  });

  it('ML-WS2: a member sees no Editar límite control and no actions column', async () => {
    mockGetSpendingLimits.mockResolvedValue({ data: [row({ user_id: 5, name: 'Mía', role: 'member' })] });

    render(<MembersLimitsSection organizationId={7} isAdmin={false} />);

    await screen.findByRole('table');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });
});

describe('MembersLimitsSection (admin edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSpendingLimits.mockResolvedValue({ data: ADMIN_VIEW });
    mockSetSpendingLimit.mockResolvedValue({ data: row() });
  });

  it('ML-WS1: an admin gets Editar límite on every row, own and other admins included', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);

    await screen.findByRole('table');
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    rows.forEach((tr) => expect(within(tr).getByRole('button', { name: 'Editar límite' })).toBeInTheDocument());
  });

  it('opens the modal for the clicked member, pre-filled with that member', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);

    await screen.findByRole('table');
    fireEvent.click(within(bodyRows()[1]).getByRole('button', { name: 'Editar límite' }));

    expect(screen.getByRole('dialog', { name: 'Límite mensual de Luis Mora' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sin límite')).toBeChecked();
  });

  it('ML-WS5: saving updates the row without a reload and closes the modal', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);
    await screen.findByRole('table');
    mockGetSpendingLimits.mockResolvedValue({
      data: [row(), row({ user_id: 2, name: 'Luis Mora', role: 'member', monthly_limit: '750.00', spent: '35.50' })],
    });

    fireEvent.click(within(bodyRows()[1]).getByRole('button', { name: 'Editar límite' }));
    fireEvent.click(screen.getByLabelText('Sin límite'));
    fireEvent.change(screen.getByLabelText('Límite mensual (USD)'), { target: { value: '750' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, '750');
    await waitFor(() => expect(bodyRows()[1]).toHaveTextContent('$750.00'));
    expect(mockGetSpendingLimits).toHaveBeenCalledTimes(2);
  });

  it('keeps the modal and the old row when the save is rejected', async () => {
    mockSetSpendingLimit.mockRejectedValue({ response: { status: 403, data: { message: 'No autorizado' } } });
    render(<MembersLimitsSection organizationId={7} isAdmin />);
    await screen.findByRole('table');

    fireEvent.click(within(bodyRows()[0]).getByRole('button', { name: 'Editar límite' }));
    fireEvent.change(screen.getByLabelText('Límite mensual (USD)'), { target: { value: '750' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('No autorizado');
    expect(mockGetSpendingLimits).toHaveBeenCalledTimes(1);
    expect(bodyRows()[0]).toHaveTextContent('$500.00');
  });

  it('Cancelar closes the modal without a request', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);
    await screen.findByRole('table');

    fireEvent.click(within(bodyRows()[0]).getByRole('button', { name: 'Editar límite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSetSpendingLimit).not.toHaveBeenCalled();
  });

  it('ML-WS19: a wallet event refreshes the consumed amount', async () => {
    render(<MembersLimitsSection organizationId={7} isAdmin />);
    await screen.findByRole('table');
    expect(bodyRows()[0]).toHaveTextContent('$120.00');
    mockGetSpendingLimits.mockResolvedValue({ data: [row({ spent: '420.00' })] });

    act(() => notifyWalletChanged());

    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent('$420.00'));
  });
});
