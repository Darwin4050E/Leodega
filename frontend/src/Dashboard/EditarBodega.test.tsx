import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetStoreRoomDetail = vi.hoisted(() => vi.fn());
const mockUpdateStoreRoom = vi.hoisted(() => vi.fn());
const mockReplaceStoreRoomPermit = vi.hoisted(() => vi.fn());
const mockResubmitStoreRoom = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('../services/storeRooms', () => ({
  getStoreRoomDetail: mockGetStoreRoomDetail,
  updateStoreRoom: mockUpdateStoreRoom,
  replaceStoreRoomPermit: mockReplaceStoreRoomPermit,
  resubmitStoreRoom: mockResubmitStoreRoom,
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

  it('maps server-side validation errors from a 422 onto the fields', async () => {
    mockUpdateStoreRoom.mockRejectedValue({
      response: {
        status: 422,
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

function pdfFile(name = 'permiso.pdf', type = 'application/pdf', size?: number) {
  const file = new File(['%PDF'], name, { type });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('EditarBodega fire permit replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoreRoomDetail.mockResolvedValue(detailResponse);
  });

  it('keeps the permit submit disabled until a PDF is chosen', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Reemplazar permiso' })).toBeDisabled();
  });

  it('rejects a non-PDF file client-side without calling the API', async () => {
    renderPage();
    const input = await screen.findByLabelText('Permiso de bomberos (PDF)');
    fireEvent.change(input, { target: { files: [pdfFile('foto.png', 'image/png')] } });

    expect(await screen.findByText('El permiso debe ser un archivo PDF.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reemplazar permiso' })).toBeDisabled();
    expect(mockReplaceStoreRoomPermit).not.toHaveBeenCalled();
  });

  it('rejects a PDF over 5 MB client-side', async () => {
    renderPage();
    const input = await screen.findByLabelText('Permiso de bomberos (PDF)');
    fireEvent.change(input, { target: { files: [pdfFile('grande.pdf', 'application/pdf', 5 * 1024 * 1024 + 1)] } });

    expect(await screen.findByText('El permiso no debe superar los 5 MB.')).toBeInTheDocument();
  });

  it('uploads the chosen PDF and shows the server success message', async () => {
    mockReplaceStoreRoomPermit.mockResolvedValue({
      data: { message: 'El permiso de bomberos se reemplazó correctamente.', status: 200 },
    });
    renderPage();
    const file = pdfFile();
    fireEvent.change(await screen.findByLabelText('Permiso de bomberos (PDF)'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar permiso' }));

    await waitFor(() => expect(mockReplaceStoreRoomPermit).toHaveBeenCalledWith('7', file));
    expect(
      await screen.findByText('El permiso de bomberos se reemplazó correctamente.')
    ).toBeInTheDocument();
    expect(mockUpdateStoreRoom).not.toHaveBeenCalled();
  });

  it('maps a 422 firefighter_permit error under the permit field', async () => {
    mockReplaceStoreRoomPermit.mockRejectedValue({
      response: {
        status: 422,
        data: { message: 'Validation Error', errors: { firefighter_permit: ['El permiso debe ser un archivo PDF.'] } },
      },
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Permiso de bomberos (PDF)'), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar permiso' }));

    expect(await screen.findByText('El permiso debe ser un archivo PDF.')).toBeInTheDocument();
  });
});

describe('EditarBodega resubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not offer resubmission for a room that is not rejected', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse.data, publication_status: 'approved' },
    });
    renderPage();
    await screen.findByLabelText('Título');
    expect(screen.queryByRole('button', { name: 'Reenviar a revisión' })).not.toBeInTheDocument();
  });

  it('resubmits a rejected room, shows the success message and hides the button', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse.data, publication_status: 'rejected' },
    });
    mockResubmitStoreRoom.mockResolvedValue({
      data: { message: 'La bodega fue reenviada a revisión.', status: 200 },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar a revisión' }));

    await waitFor(() => expect(mockResubmitStoreRoom).toHaveBeenCalledWith('7'));
    expect(await screen.findByText('La bodega fue reenviada a revisión.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reenviar a revisión' })).not.toBeInTheDocument();
  });

  it('shows the server message on 409 and keeps the button', async () => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse.data, publication_status: 'rejected' },
    });
    mockResubmitStoreRoom.mockRejectedValue({
      response: { status: 409, data: { message: 'Solo una bodega rechazada puede reenviarse a revisión.' } },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar a revisión' }));

    expect(
      await screen.findByText('Solo una bodega rechazada puede reenviarse a revisión.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar a revisión' })).toBeInTheDocument();
  });
});

describe('EditarBodega re-review warning', () => {
  const REVIEW_CONFIRM =
    'Este cambio enviará tu bodega a revisión y dejará de estar disponible para nuevas reservas hasta ser aprobada. ¿Quieres continuar?';
  const REVIEW_NOTICE =
    'Tu bodega volvió a revisión y dejará de estar disponible para nuevas reservas hasta que un administrador la apruebe.';

  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse.data, publication_status: 'approved' },
    });
    mockUpdateStoreRoom.mockResolvedValue({
      data: { message: 'Los cambios se guardaron correctamente.', status: 200, requires_review: false },
    });
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('asks for confirmation before saving a material change on an approved room', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Bodega Renovada' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith('7', { title: 'Bodega Renovada' })
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith(REVIEW_CONFIRM);
  });

  it.each([
    ['description', 'Descripción', 'Otra descripción'],
    ['size', 'Dimensiones (m²)', '40'],
    ['price', 'Tarifa mensual (USD)', '200'],
  ])('also asks for confirmation when only the %s changes', async (_field, label, value) => {
    renderPage();
    fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockUpdateStoreRoom).toHaveBeenCalledTimes(1));
    expect(confirmSpy).toHaveBeenCalledWith(REVIEW_CONFIRM);
  });

  it('does not save when the gestor declines the confirmation', async () => {
    confirmSpy.mockReturnValue(false);
    renderPage();
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Bodega Renovada' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(mockUpdateStoreRoom).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Título')).toHaveValue('Bodega Renovada');
  });

  it('skips the confirmation when only the disponibility changes', async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText('Disponible para nuevas reservas'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith('7', { disponibility: false })
    );
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it.each(['pending', 'rejected'])('skips the confirmation for a %s room', async (status) => {
    mockGetStoreRoomDetail.mockResolvedValue({
      data: { ...detailResponse.data, publication_status: status },
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Bodega Renovada' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockUpdateStoreRoom).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('shows the review notice, treats the room as pending and stops asking again', async () => {
    mockUpdateStoreRoom.mockResolvedValue({
      data: {
        message: 'Los cambios se guardaron correctamente.',
        status: 200,
        requires_review: true,
        review_notice: REVIEW_NOTICE,
      },
    });
    renderPage();
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Primera edición' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(REVIEW_NOTICE)).toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Segunda edición' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockUpdateStoreRoom).toHaveBeenCalledTimes(2));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('does not show a review notice when the response does not flag one', async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText('Disponible para nuevas reservas'));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText('Los cambios se guardaron correctamente.')).toBeInTheDocument();
    expect(screen.queryByText(REVIEW_NOTICE)).not.toBeInTheDocument();
  });
});
