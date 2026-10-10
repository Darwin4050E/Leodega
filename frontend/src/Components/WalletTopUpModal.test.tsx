import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockTopUpWallet = vi.hoisted(() => vi.fn());
vi.mock('../services/organizations', () => ({ topUpWallet: mockTopUpWallet }));

import WalletTopUpModal from './WalletTopUpModal';
import { subscribeToWalletChanges } from '../utils/walletEvents';

const AMOUNT_MESSAGE = 'El monto de la recarga debe estar entre $50 y $50.000';

function topUpResponse(balance: string) {
  return { data: { message: 'Recarga realizada correctamente', balance, movement: { id: 1 } } };
}

function setup() {
  const onClose = vi.fn();
  const onWalletChanged = vi.fn();
  const unsubscribe = subscribeToWalletChanges(onWalletChanged);
  render(<WalletTopUpModal organizationId={7} onClose={onClose} />);
  return { onClose, onWalletChanged, unsubscribe };
}

function typeAmount(value: string) {
  fireEvent.change(screen.getByLabelText('Monto a recargar'), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recarga' }));
}

describe('WalletTopUpModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('OW-WS6: tops up 100, announces the wallet change and closes', async () => {
    mockTopUpWallet.mockResolvedValue(topUpResponse('180.50'));
    const { onClose, onWalletChanged, unsubscribe } = setup();

    typeAmount('100');
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockTopUpWallet).toHaveBeenCalledWith(7, '100');
    expect(onWalletChanged).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it.each(['50', '50000', '99.5', '1234.56'])('sends the valid amount %s unchanged', async (amount) => {
    mockTopUpWallet.mockResolvedValue(topUpResponse('1.00'));
    const { onClose, unsubscribe } = setup();

    typeAmount(amount);
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockTopUpWallet).toHaveBeenCalledWith(7, amount);
    unsubscribe();
  });

  it.each(['49.99', '50000.01', '100.005', '0', 'abc', '', '-100', '1e3'])(
    'rejects %j with the bounds message and sends nothing',
    (amount) => {
      const { onClose, onWalletChanged, unsubscribe } = setup();

      typeAmount(amount);
      submit();

      expect(screen.getByRole('alert')).toHaveTextContent(AMOUNT_MESSAGE);
      expect(mockTopUpWallet).not.toHaveBeenCalled();
      expect(onWalletChanged).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      unsubscribe();
    },
  );

  it('OW-WS8: shows the server message and changes nothing when the server rejects the amount', async () => {
    mockTopUpWallet.mockRejectedValue({
      response: { status: 422, data: { message: 'rechazado', errors: { amount: [AMOUNT_MESSAGE] } } },
    });
    const { onClose, onWalletChanged, unsubscribe } = setup();

    typeAmount('100');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(AMOUNT_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
    expect(onWalletChanged).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('falls back to the response message, then to a generic one, for other failures', async () => {
    mockTopUpWallet.mockRejectedValueOnce({ response: { status: 403, data: { message: 'No autorizado' } } });
    mockTopUpWallet.mockRejectedValueOnce({});
    const { unsubscribe } = setup();

    typeAmount('100');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado');

    submit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo realizar la recarga. Intenta nuevamente.'),
    );
    unsubscribe();
  });

  it('sends a single request when the button is clicked twice in a row', async () => {
    mockTopUpWallet.mockReturnValue(new Promise(() => {}));
    const { unsubscribe } = setup();

    typeAmount('100');
    submit();
    const busy = screen.getByRole('button', { name: 'Procesando...' });
    fireEvent.click(busy);

    expect(busy).toBeDisabled();
    expect(mockTopUpWallet).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('discloses that the top-up is simulated and closes on cancel without a request', () => {
    const { onClose, unsubscribe } = setup();

    expect(screen.getByText(/Recarga simulada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockTopUpWallet).not.toHaveBeenCalled();
    unsubscribe();
  });
});
