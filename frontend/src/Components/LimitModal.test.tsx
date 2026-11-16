import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockSetSpendingLimit = vi.hoisted(() => vi.fn());
vi.mock('../services/organizations', () => ({ setSpendingLimit: mockSetSpendingLimit }));

import LimitModal from './LimitModal';

const VALIDATION_MESSAGE =
  'El límite mensual debe ser un monto mayor que 0, con hasta 6 dígitos enteros y 2 decimales';

function memberRow(overrides = {}) {
  return {
    user_id: 2,
    name: 'Luis Mora',
    role: 'member' as const,
    monthly_limit: '500.00' as string | null,
    spent: '120.00',
    ...overrides,
  };
}

function setup(row = memberRow()) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<LimitModal organizationId={7} row={row} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

const field = () => screen.getByLabelText('Límite mensual (USD)') as HTMLInputElement;

function typeLimit(value: string) {
  fireEvent.change(field(), { target: { value } });
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('LimitModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetSpendingLimit.mockResolvedValue({ data: memberRow({ monthly_limit: '750.00' }) });
  });

  it('titles the dialog with the member name and pre-fills the current limit', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'Límite mensual de Luis Mora' })).toBeInTheDocument();
    expect(field().value).toBe('500.00');
    expect(field()).not.toBeDisabled();
    expect(screen.getByLabelText('Sin límite')).not.toBeChecked();
  });

  it('ML-WS5: saving 750 calls the set endpoint, reports the save and closes', async () => {
    const { onClose, onSaved } = setup();

    typeLimit('750');
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, '750');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it.each(['0.01', '1500.5', '999999.99'])('sends the valid amount %s unchanged', async (amount) => {
    const { onClose } = setup();

    typeLimit(amount);
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, amount);
  });

  it('ML-WS6: Sin límite disables the field and sends null', async () => {
    const { onClose } = setup();

    fireEvent.click(screen.getByLabelText('Sin límite'));
    expect(field()).toBeDisabled();
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, null);
  });

  it('opens a member without a limit with Sin límite checked and the field disabled', () => {
    setup(memberRow({ monthly_limit: null }));

    expect(screen.getByLabelText('Sin límite')).toBeChecked();
    expect(field()).toBeDisabled();
    expect(field().value).toBe('');
  });

  it('unchecking Sin límite enables the field again so a limit can be set', async () => {
    const { onClose } = setup(memberRow({ monthly_limit: null }));

    fireEvent.click(screen.getByLabelText('Sin límite'));
    typeLimit('300');
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, '300');
  });

  it.each(['', '   ', '0', '0.00', '1234567', '1.234', 'abc', '-5', '1e3'])(
    'ML-WS7: rejects %j with the validation text and sends nothing',
    (value) => {
      const { onClose, onSaved } = setup();

      typeLimit(value);
      save();

      expect(screen.getByRole('alert')).toHaveTextContent(VALIDATION_MESSAGE);
      expect(mockSetSpendingLimit).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
    },
  );

  it('ML-WS8: warns with the consumed amount when the limit is below it, yet still saves', async () => {
    const { onClose } = setup(memberRow({ spent: '800.00' }));

    typeLimit('500');

    expect(screen.getByText(/Este miembro ya consumió \$800\.00 este mes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSetSpendingLimit).toHaveBeenCalledWith(7, 2, '500');
  });

  it.each(['800', '900'])('ML-WS9: no warning when the limit %s is at least the consumed amount', (value) => {
    setup(memberRow({ spent: '800.00' }));

    typeLimit(value);

    expect(screen.queryByText(/Este miembro ya consumió/)).not.toBeInTheDocument();
  });

  it('ML-WS9: no warning with Sin límite checked nor with an unparseable value', () => {
    setup(memberRow({ spent: '800.00' }));

    typeLimit('abc');
    expect(screen.queryByText(/Este miembro ya consumió/)).not.toBeInTheDocument();

    typeLimit('500');
    expect(screen.getByText(/Este miembro ya consumió/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Sin límite'));
    expect(screen.queryByText(/Este miembro ya consumió/)).not.toBeInTheDocument();
  });

  it.each([
    [422, VALIDATION_MESSAGE],
    [403, 'No autorizado'],
    [404, 'Miembro no encontrado'],
  ])('ML-WS10: a server %i keeps the modal open with its message and the input', async (status, message) => {
    mockSetSpendingLimit.mockRejectedValue({ response: { status, data: { message } } });
    const { onClose, onSaved } = setup();

    typeLimit('750');
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(field().value).toBe('750');
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('prefers the monthly_limit field error over the top-level message', async () => {
    mockSetSpendingLimit.mockRejectedValue({
      response: { status: 422, data: { message: 'general', errors: { monthly_limit: [VALIDATION_MESSAGE] } } },
    });
    setup();

    typeLimit('750');
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent(VALIDATION_MESSAGE);
  });

  it('falls back to a generic message when the failure carries none', async () => {
    mockSetSpendingLimit.mockRejectedValue(new Error('Network Error'));
    setup();

    typeLimit('750');
    save();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el límite. Intenta nuevamente.');
  });

  it('disables Guardar while the request is in flight so it is sent once', async () => {
    mockSetSpendingLimit.mockReturnValue(new Promise(() => {}));
    setup();

    typeLimit('750');
    save();

    const pending = await screen.findByRole('button', { name: 'Guardando...' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(mockSetSpendingLimit).toHaveBeenCalledTimes(1);
  });

  it('Cancelar closes without sending anything', () => {
    const { onClose, onSaved } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockSetSpendingLimit).not.toHaveBeenCalled();
  });

  it('explains that the whole cost counts in the month the reservation starts', () => {
    setup();

    expect(screen.getByText(/mes en que empieza/)).toBeInTheDocument();
  });
});
