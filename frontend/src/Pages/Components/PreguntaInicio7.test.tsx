import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// Polyfill localStorage for environments that do not provide it (e.g., vitest
// running in a node-based vm without --localstorage-file).
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
    },
    writable: true,
  });
}
import PreguntaInicio7 from './PreguntaInicio7';
import { WizardProvider, WizardContext } from '../../context/WizardContext';
import type { WizardContextValue } from '../../context/WizardContext';

// Mocks -----------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('./ProgressBar', () => ({ default: () => null }));

vi.mock('./FooterNav', () => ({
  default: ({
    onNext,
    nextDisabled,
    nextLabel,
  }: {
    onNext: () => void;
    nextDisabled: boolean;
    nextLabel?: string;
  }) => (
    <button
      data-testid="submit-btn"
      onClick={onNext}
      disabled={nextDisabled}
    >
      {nextLabel ?? 'Siguiente'}
    </button>
  ),
}));

vi.mock('../../Components/ModalConfirmacion', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="success-modal" /> : null,
}));

const mockCreateStoreRoom = vi.fn();
const mockUploadPhotos = vi.fn();

vi.mock('../../services/storeRooms', () => ({
  createStoreRoom: (...args: unknown[]) => mockCreateStoreRoom(...args),
  uploadStoreRoomPhotos: (...args: unknown[]) => mockUploadPhotos(...args),
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({
    user: { landlord: { id: 1 } },
  }),
}));

const makeFile = (name: string, type = 'image/jpeg') =>
  new File(['content'], name, { type });

// Wrapper factories -------------------------------------------------------

const WizardWrapper =
  (overrides: Partial<WizardContextValue> = {}) =>
  ({ children }: { children: ReactNode }) => {
    const defaults: WizardContextValue = {
      photos: [],
      setPhotos: vi.fn(),
      permit: null,
      setPermit: vi.fn(),
      reset: vi.fn(),
    };
    return (
      <WizardContext.Provider value={{ ...defaults, ...overrides }}>
        {children}
      </WizardContext.Provider>
    );
  };

// Tests ------------------------------------------------------------------

describe('PreguntaInicio7 — submit gate and permit requirement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('submit is DISABLED when permit is null (no policy selected either)', () => {
    const wrapper = WizardWrapper({ permit: null });
    render(<PreguntaInicio7 />, { wrapper });

    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit is DISABLED when permit is null even if policy is selected', () => {
    const wrapper = WizardWrapper({ permit: null });
    render(<PreguntaInicio7 />, { wrapper });

    // Select a cancellation policy.
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'flexible' } });

    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit is DISABLED when permit is set but no policy is selected', () => {
    const permitFile = makeFile('permit.pdf', 'application/pdf');
    const wrapper = WizardWrapper({ permit: permitFile });
    render(<PreguntaInicio7 />, { wrapper });

    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('submit is ENABLED when both permit and policy are provided', async () => {
    const permitFile = makeFile('permit.pdf', 'application/pdf');
    const wrapper = WizardWrapper({ permit: permitFile });
    render(<PreguntaInicio7 />, { wrapper });

    // Select a cancellation policy.
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'moderada' } });

    const btn = screen.getByTestId('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('rejects a non-PDF permit and never stores it in the wizard', () => {
    const setPermit = vi.fn();
    const wrapper = WizardWrapper({ permit: null, setPermit });
    const { container } = render(<PreguntaInicio7 />, { wrapper });

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('permit.jpg', 'image/jpeg')] },
    });

    expect(setPermit).not.toHaveBeenCalledWith(expect.any(File));
    expect(
      screen.getByText('El permiso debe ser un archivo PDF.'),
    ).toBeInTheDocument();
  });

  it('rejects a permit larger than 5 MB', () => {
    const setPermit = vi.fn();
    const wrapper = WizardWrapper({ permit: null, setPermit });
    const { container } = render(<PreguntaInicio7 />, { wrapper });

    const bigPdf = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      'permit.pdf',
      { type: 'application/pdf' },
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigPdf] } });

    expect(setPermit).not.toHaveBeenCalledWith(expect.any(File));
    expect(
      screen.getByText('El permiso no debe superar los 5 MB.'),
    ).toBeInTheDocument();
  });

  it('submit sends ONE multipart registration request (with the permit) then uploads photos separately', async () => {
    const user = userEvent.setup();

    const photos = [makeFile('a.jpg'), makeFile('b.jpg')];
    const permitFile = makeFile('permit.pdf', 'application/pdf');
    const resetMock = vi.fn();

    mockCreateStoreRoom.mockResolvedValue({ status: 201, data: { item: { id: 42 } } });
    mockUploadPhotos.mockResolvedValue(undefined);

    const wrapper = WizardWrapper({ photos, permit: permitFile, reset: resetMock });

    localStorage.setItem('optionData', JSON.stringify({
      step1Data: { selectedOption: 'bodega' },
      step2Data: { selectedOption: 'completa' },
      location: { direction: 'Av. Test', city: 'Quito' },
      priceData: { tamano: 30, precio: 150 },
      titleData: { titulo: 'Bodega A', descripcion: 'Desc' },
    }));

    render(<PreguntaInicio7 />, { wrapper });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'flexible' } });

    const btn = screen.getByTestId('submit-btn');
    await user.click(btn);

    // Wait for async operations.
    await vi.waitFor(() => {
      expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
      expect(mockUploadPhotos).toHaveBeenCalledTimes(1);
    });

    // createStoreRoom is called with a single FormData containing the permit
    // file and cancellation_policy_tier — no separate permit upload call.
    const [formData] = mockCreateStoreRoom.mock.calls[0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('cancellation_policy_tier')).toBe('flexible');
    expect(formData.get('firefighter_permit')).toBe(permitFile);
    expect(formData.get('storePrices[0][mode]')).toBe('month');
    expect(formData.get('storePrices[0][price]')).toBe('150');
    expect(formData.get('size')).toBe('30');

    // Photos are still uploaded via the separate endpoint, after registration.
    expect(mockUploadPhotos).toHaveBeenCalledWith(42, expect.any(FormData));

    expect(resetMock).toHaveBeenCalled();
  });
});

describe('PreguntaInicio7 — no zero fallbacks for size and price', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const submitWith = async (priceData: Record<string, unknown> | undefined) => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const wrapper = WizardWrapper({
      photos: [],
      permit: makeFile('permit.pdf', 'application/pdf'),
      reset: vi.fn(),
    });

    localStorage.setItem('optionData', JSON.stringify({
      step1Data: { selectedOption: 'bodega' },
      step2Data: { selectedOption: 'completa' },
      location: { direction: 'Av. Test', city: 'Quito' },
      ...(priceData ? { priceData } : {}),
      titleData: { titulo: 'Bodega A', descripcion: 'Desc' },
    }));

    render(<PreguntaInicio7 />, { wrapper });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'flexible' } });
    await user.click(screen.getByTestId('submit-btn'));

    return alertSpy;
  };

  it.each([
    ['size is zero', { tamano: 0, precio: 150 }],
    ['price is zero', { tamano: 30, precio: 0 }],
    ['size is an empty string', { tamano: '', precio: 150 }],
    ['price is an empty string', { tamano: 30, precio: '' }],
    ['the price step data is missing', undefined],
  ])('alerts and sends no request when %s', async (_label, priceData) => {
    const alertSpy = await submitWith(priceData);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockCreateStoreRoom).not.toHaveBeenCalled();
  });

  it('sends the entered size and price without any fallback', async () => {
    mockCreateStoreRoom.mockResolvedValue({ status: 201, data: { item: { id: 9 } } });
    const alertSpy = await submitWith({ tamano: '12.5', precio: '80.25' });

    await vi.waitFor(() => {
      expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
    });

    const [formData] = mockCreateStoreRoom.mock.calls[0];
    expect(formData.get('size')).toBe('12.5');
    expect(formData.get('storePrices[0][price]')).toBe('80.25');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('PreguntaInicio7 — security features payload', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the fourth security feature as restricted 24/7 access', () => {
    const wrapper = WizardWrapper({ permit: null });
    render(<PreguntaInicio7 />, { wrapper });

    expect(screen.getByText('Acceso restringido 24/7')).toBeInTheDocument();
  });

  it('writes the fourth feature under the `acceso` key, never the legacy `objetos` key', async () => {
    const user = userEvent.setup();

    const permitFile = makeFile('permit.pdf', 'application/pdf');
    mockCreateStoreRoom.mockResolvedValue({ status: 201, data: { item: { id: 7 } } });
    mockUploadPhotos.mockResolvedValue(undefined);

    const wrapper = WizardWrapper({ photos: [], permit: permitFile, reset: vi.fn() });

    localStorage.setItem('optionData', JSON.stringify({
      step1Data: { selectedOption: 'bodega' },
      step2Data: { selectedOption: 'completa' },
      location: { direction: 'Av. Test', city: 'Quito' },
      priceData: { tamano: 30, precio: 150 },
      titleData: { titulo: 'Bodega A', descripcion: 'Desc' },
    }));

    render(<PreguntaInicio7 />, { wrapper });

    // Tick the fourth security checkbox by its label.
    await user.click(
      screen.getByText('Acceso restringido 24/7').closest('label')!
        .querySelector('input[type="checkbox"]')!,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'flexible' } });

    await user.click(screen.getByTestId('submit-btn'));

    await vi.waitFor(() => {
      expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
    });

    const [formData] = mockCreateStoreRoom.mock.calls[0];
    const security = JSON.parse(formData.get('security') as string);

    expect(security).toEqual({
      camara: false,
      ruido: false,
      control: false,
      acceso: true,
    });
    expect(security).not.toHaveProperty('objetos');
  });
});

describe('PreguntaInicio7 — photo upload failure and retry', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const photos = [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')];

  const submitWithPhotoFailure = async () => {
    const user = userEvent.setup();
    const resetMock = vi.fn();

    mockCreateStoreRoom.mockResolvedValue({ status: 201, data: { item: { id: 42 } } });
    mockUploadPhotos.mockRejectedValueOnce(new Error('network'));

    const wrapper = WizardWrapper({
      photos,
      permit: makeFile('permit.pdf', 'application/pdf'),
      reset: resetMock,
    });

    localStorage.setItem('optionData', JSON.stringify({
      step1Data: { selectedOption: 'bodega' },
      step2Data: { selectedOption: 'completa' },
      location: { direction: 'Av. Test', city: 'Quito' },
      priceData: { tamano: 30, precio: 150 },
      titleData: { titulo: 'Bodega A', descripcion: 'Desc' },
    }));

    render(<PreguntaInicio7 />, { wrapper });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'flexible' } });
    await user.click(screen.getByTestId('submit-btn'));

    await screen.findByRole('alert');

    return { user, resetMock };
  };

  it('keeps the wizard and offers retry when the photo upload fails', async () => {
    const { resetMock } = await submitWithPhotoFailure();

    expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos subir las fotos/);
    expect(screen.getByRole('button', { name: 'Reintentar subida de fotos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a mis bodegas' })).toBeInTheDocument();
    expect(resetMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('optionData')).not.toBeNull();
    expect(screen.queryByTestId('success-modal')).not.toBeInTheDocument();
  });

  it('retries only the photo upload against the created room and then finishes', async () => {
    const { user, resetMock } = await submitWithPhotoFailure();
    mockUploadPhotos.mockResolvedValueOnce(undefined);

    await user.click(screen.getByRole('button', { name: 'Reintentar subida de fotos' }));

    await screen.findByTestId('success-modal', {}, { timeout: 4000 });

    expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
    expect(mockUploadPhotos).toHaveBeenCalledTimes(2);
    expect(mockUploadPhotos).toHaveBeenLastCalledWith(42, expect.any(FormData));
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('optionData')).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps offering retry when the retry fails again', async () => {
    const { user, resetMock } = await submitWithPhotoFailure();
    mockUploadPhotos.mockRejectedValueOnce(new Error('still down'));

    await user.click(screen.getByRole('button', { name: 'Reintentar subida de fotos' }));

    await vi.waitFor(() => {
      expect(mockUploadPhotos).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByRole('button', { name: 'Reintentar subida de fotos' }),
    ).toBeInTheDocument();
    expect(resetMock).not.toHaveBeenCalled();
    expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
  });

  it('sends the gestor back to their rooms from the failure notice', async () => {
    const { user } = await submitWithPhotoFailure();

    await user.click(screen.getByRole('button', { name: 'Volver a mis bodegas' }));

    expect(mockNavigate).toHaveBeenCalledWith('/arrendador/bodegas');
  });

  it('never creates a second room when Enviar is pressed again after the failure', async () => {
    const { user } = await submitWithPhotoFailure();
    mockUploadPhotos.mockResolvedValueOnce(undefined);

    await user.click(screen.getByTestId('submit-btn'));

    await vi.waitFor(() => {
      expect(mockUploadPhotos).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateStoreRoom).toHaveBeenCalledTimes(1);
  });
});
