import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());
const mockUpdateStoreRoom = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('../services/storeRooms', () => ({
  getStoreRoomDetail: mockGetStoreRoomDetail,
  updateStoreRoom: mockUpdateStoreRoom,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '7' }),
  };
});

import EditarBodega from './EditarBodega';

const detailResponse = {
  data: {
    title: 'Bodega Uno',
    description: 'Espacio seco y ventilado',
    size: 25,
    prices: [{ mode: 'month', price: 150, disponibility: 1 }],
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <EditarBodega />
    </MemoryRouter>
  );
}

describe('EditarBodega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoreRoomDetail.mockResolvedValue(detailResponse);
    mockUpdateStoreRoom.mockResolvedValue({
      data: { message: 'Los cambios se guardaron correctamente.', status: 200 },
    });
  });

  it('prefills the form with the current warehouse values', async () => {
    renderPage();

    expect(await screen.findByLabelText('Título')).toHaveValue('Bodega Uno');
    expect(screen.getByLabelText('Descripción')).toHaveValue('Espacio seco y ventilado');
    expect(screen.getByLabelText('Dimensiones (m²)')).toHaveValue(25);
    expect(screen.getByLabelText('Tarifa mensual (USD)')).toHaveValue(150);
    expect(screen.getByLabelText('Disponible para nuevas reservas')).toBeChecked();
  });

  it('blocks the submit and shows a field error when the tarifa is zero (scenario 2)', async () => {
    renderPage();

    const price = await screen.findByLabelText('Tarifa mensual (USD)');
    fireEvent.change(price, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(
      await screen.findByText('La tarifa mensual debe ser mayor a 0.')
    ).toBeInTheDocument();
    expect(mockUpdateStoreRoom).not.toHaveBeenCalled();
  });

  it('blocks the submit and highlights the title when it is cleared (scenario 2)', async () => {
    renderPage();

    const title = await screen.findByLabelText('Título');
    fireEvent.change(title, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('El título es obligatorio.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(mockUpdateStoreRoom).not.toHaveBeenCalled();
  });

  it('saves only the changed fields and shows the success message (scenario 1)', async () => {
    renderPage();

    const title = await screen.findByLabelText('Título');
    fireEvent.change(title, { target: { value: 'Bodega Renovada' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith('7', { title: 'Bodega Renovada' })
    );
    expect(
      await screen.findByText('Los cambios se guardaron correctamente.')
    ).toBeInTheDocument();
  });

  it('maps server-side validation errors from a 400 onto the fields', async () => {
    mockUpdateStoreRoom.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'Validation Error', errors: { price: ['La tarifa es inválida.'] } },
      },
    });

    renderPage();
    const price = await screen.findByLabelText('Tarifa mensual (USD)');
    fireEvent.change(price, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('La tarifa es inválida.')).toBeInTheDocument();
  });

  it('renders the informational notice when the response carries one (scenario 3)', async () => {
    mockUpdateStoreRoom.mockResolvedValue({
      data: {
        message: 'Los cambios se guardaron correctamente.',
        notice:
          'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.',
        status: 200,
      },
    });

    renderPage();
    const title = await screen.findByLabelText('Título');
    fireEvent.change(title, { target: { value: 'Bodega Con Reservas' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(
      await screen.findByText(
        'Los cambios no afectan a las reservas ya confirmadas; solo aplican a nuevas reservas.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Los cambios se guardaron correctamente.')
    ).toBeInTheDocument();
  });

  it('shows an access message when the prefill request is forbidden', async () => {
    mockGetStoreRoomDetail.mockRejectedValue({ response: { status: 403 } });
    renderPage();

    expect(
      await screen.findByText('No tienes permiso para editar esta bodega.')
    ).toBeInTheDocument();
  });
});
