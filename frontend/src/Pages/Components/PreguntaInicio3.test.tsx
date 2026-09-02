import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

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
import PreguntaInicio3 from './PreguntaInicio3';
import { WizardProvider } from '../../context/WizardContext';

// Mock react-router-dom navigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock ProgressBar and FooterNav to keep rendering focused.
vi.mock('./ProgressBar', () => ({ default: () => null }));
vi.mock('./FooterNav', () => ({
  default: ({ onNext }: { onNext: () => void }) => (
    <button data-testid="next-btn" onClick={onNext}>Siguiente</button>
  ),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <WizardProvider>{children}</WizardProvider>
);

describe('PreguntaInicio3', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the photos step', () => {
    render(<PreguntaInicio3 />, { wrapper });
    expect(screen.getByText(/Agrega algunas fotos/i)).toBeTruthy();
  });

  it('clicking next stores File[] in context without writing base64 to localStorage', async () => {
    const user = userEvent.setup();
    render(<PreguntaInicio3 />, { wrapper });

    // Simulate selecting 5 images via hidden file input.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const files = Array.from({ length: 5 }, (_, i) =>
      new File(['img'], `photo_${i}.jpg`, { type: 'image/jpeg' })
    );

    await userEvent.upload(input, files);

    // Click Siguiente.
    await user.click(screen.getByTestId('next-btn'));

    // Context is internal state — verify no base64 leaked to localStorage.
    const stored = JSON.parse(localStorage.getItem('optionData') ?? '{}');
    // The photos key should not be present (or should not contain base64 strings).
    if (stored.photos) {
      expect(stored.photos.every((v: unknown) => typeof v !== 'string' || !String(v).startsWith('data:'))).toBe(true);
    } else {
      expect(stored.photos).toBeUndefined();
    }

    // And navigate was called.
    expect(mockNavigate).toHaveBeenCalledWith('/preguntainicio4');
  });
});
