import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetOrganizationWallet = vi.hoisted(() => vi.fn());
vi.mock('../services/organizations', () => ({ getOrganizationWallet: mockGetOrganizationWallet }));

import WalletBalanceChip from './WalletBalanceChip';
import { notifyWalletChanged } from '../utils/walletEvents';

function wallet(organizationId: number, balance: string) {
  return { data: { organization_id: organizationId, balance } };
}

function renderChip(organizationId: number) {
  const ui = (id: number) => (
    <MemoryRouter>
      <WalletBalanceChip organizationId={id} />
    </MemoryRouter>
  );
  const view = render(ui(organizationId));
  return { ...view, switchTo: (id: number) => view.rerender(ui(id)) };
}

describe('WalletBalanceChip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('OW-WS1: shows the label and the two-decimal balance, linking to the wallet page', async () => {
    mockGetOrganizationWallet.mockResolvedValue(wallet(7, '80.50'));

    renderChip(7);

    const chip = await screen.findByRole('link', { name: /Saldo/ });
    expect(chip).toHaveTextContent('Saldo');
    expect(chip).toHaveTextContent('$80.50');
    expect(chip).toHaveAttribute('href', '/organizacion/billetera');
    expect(mockGetOrganizationWallet).toHaveBeenCalledWith(7);
  });

  it('OW-WS2: renders nothing while the balance is loading', () => {
    mockGetOrganizationWallet.mockReturnValue(new Promise(() => {}));

    const { container } = renderChip(7);

    expect(container).toBeEmptyDOMElement();
  });

  it('OW-WS2: renders nothing when the balance request fails', async () => {
    mockGetOrganizationWallet.mockRejectedValue({ response: { status: 500 } });

    const { container } = renderChip(7);

    await waitFor(() => expect(mockGetOrganizationWallet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('OW-WS15: refetches and shows the new balance when a wallet change is announced', async () => {
    mockGetOrganizationWallet
      .mockResolvedValueOnce(wallet(7, '80.50'))
      .mockResolvedValueOnce(wallet(7, '130.50'));
    renderChip(7);
    expect(await screen.findByRole('link')).toHaveTextContent('$80.50');

    act(() => notifyWalletChanged());

    await waitFor(() => expect(screen.getByRole('link')).toHaveTextContent('$130.50'));
    expect(mockGetOrganizationWallet).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the last balance while a refetch is in flight (no flicker)', async () => {
    mockGetOrganizationWallet
      .mockResolvedValueOnce(wallet(7, '80.50'))
      .mockReturnValueOnce(new Promise(() => {}));
    renderChip(7);
    expect(await screen.findByRole('link')).toHaveTextContent('$80.50');

    act(() => notifyWalletChanged());

    expect(screen.getByRole('link')).toHaveTextContent('$80.50');
  });

  it('OW-WS16: discards a late response that belongs to the previous organization', async () => {
    let resolveFirst: (value: ReturnType<typeof wallet>) => void = () => {};
    mockGetOrganizationWallet
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(wallet(8, '20.00'));
    const { switchTo } = renderChip(7);

    switchTo(8);
    expect(await screen.findByRole('link')).toHaveTextContent('$20.00');
    await act(async () => resolveFirst(wallet(7, '999.00')));

    expect(screen.getByRole('link')).toHaveTextContent('$20.00');
    expect(screen.getByRole('link')).not.toHaveTextContent('999');
  });

  it('does not show the previous organization balance while the next one is loading', async () => {
    mockGetOrganizationWallet
      .mockResolvedValueOnce(wallet(7, '80.50'))
      .mockReturnValueOnce(new Promise(() => {}));
    const { switchTo, container } = renderChip(7);
    expect(await screen.findByRole('link')).toHaveTextContent('$80.50');

    switchTo(8);

    expect(container).toBeEmptyDOMElement();
  });
});
