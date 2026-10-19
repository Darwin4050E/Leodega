import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseOrganizationWallet = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useOrganizationWallet', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useOrganizationWallet')>()),
  useOrganizationWallet: mockUseOrganizationWallet,
}));

import PanelWalletSummary from './PanelWalletSummary';
import { WALLET_STATUS } from '../hooks/useOrganizationWallet';
import { PANEL_COPY } from '../utils/panelCopy';

function setWallet(status: string, balance: string | null) {
  mockUseOrganizationWallet.mockReturnValue({ status, balance });
}

function renderSummary() {
  return render(
    <MemoryRouter>
      <PanelWalletSummary organizationId={7} />
    </MemoryRouter>,
  );
}

describe('PanelWalletSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WS23 / WS73: shows the title, subtitle, label and the balance with two decimals and USD', () => {
    setWallet(WALLET_STATUS.READY, '80.50');

    renderSummary();

    expect(screen.getByRole('heading', { level: 2, name: 'Billetera de la empresa' })).toBeInTheDocument();
    expect(screen.getByText(PANEL_COPY.walletSubtitle)).toBeInTheDocument();
    expect(screen.getByText('Saldo disponible')).toBeInTheDocument();
    expect(screen.getByText('$80.50')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.queryByText('Sin saldo')).not.toBeInTheDocument();
    expect(mockUseOrganizationWallet).toHaveBeenCalledWith(7);
  });

  it('WS24 / WS76: a zero balance renders $0.00 and the Sin saldo badge', () => {
    setWallet(WALLET_STATUS.READY, '0.00');

    renderSummary();

    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Sin saldo')).toBeInTheDocument();
  });

  it('WS25 / WS67: links to the wallet page and offers no top-up control', () => {
    setWallet(WALLET_STATUS.READY, '80.50');

    renderSummary();

    expect(screen.getByRole('link', { name: 'Ver billetera' })).toHaveAttribute('href', '/organizacion/billetera');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/recargar/i)).not.toBeInTheDocument();
  });

  it('WS26: an error shows the wallet error in this section and no balance', () => {
    setWallet(WALLET_STATUS.ERROR, null);

    renderSummary();

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar el saldo');
    expect(screen.queryByText('Saldo disponible')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('WS27 / WS78: loading shows the polite status text and no balance or zero', () => {
    setWallet(WALLET_STATUS.LOADING, null);

    renderSummary();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Sin saldo')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Billetera de la empresa' })).toBeInTheDocument();
  });

  it('keeps the section heading and link while the balance is not ready', () => {
    setWallet(WALLET_STATUS.ERROR, null);

    renderSummary();

    expect(screen.getByRole('heading', { level: 2, name: 'Billetera de la empresa' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver billetera' })).toBeInTheDocument();
  });
});
