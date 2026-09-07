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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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
  default: () => null,
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

    // Photos are still uploaded via the separate endpoint, after registration.
    expect(mockUploadPhotos).toHaveBeenCalledWith(42, expect.any(FormData));

    expect(resetMock).toHaveBeenCalled();
  });
});
