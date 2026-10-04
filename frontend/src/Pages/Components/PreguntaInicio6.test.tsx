import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import PreguntaInicio6 from './PreguntaInicio6';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('./ProgressBar', () => ({ default: () => null }));

vi.mock('./FooterNav', () => ({
  default: ({
    onNext,
    nextDisabled,
  }: {
    onNext: () => void;
    nextDisabled: boolean;
  }) => (
    <button data-testid="next-btn" onClick={onNext} disabled={nextDisabled}>
      Siguiente
    </button>
  ),
}));

const fill = (price: string, size: string) => {
  fireEvent.change(screen.getByPlaceholderText('NN'), { target: { value: price } });
  fireEvent.change(screen.getByPlaceholderText('m²'), { target: { value: size } });
};

const nextButton = () => screen.getByTestId('next-btn') as HTMLButtonElement;

describe('PreguntaInicio6 — price and size gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enables Next when both price and size are positive', () => {
    render(<PreguntaInicio6 />);

    fill('150', '30');

    expect(nextButton().disabled).toBe(false);
  });

  it('keeps Next disabled while both fields are empty', () => {
    render(<PreguntaInicio6 />);

    expect(nextButton().disabled).toBe(true);
  });

  it('keeps Next disabled when the size is zero', () => {
    render(<PreguntaInicio6 />);

    fill('150', '0');

    expect(nextButton().disabled).toBe(true);
  });

  it('keeps Next disabled when the price is zero', () => {
    render(<PreguntaInicio6 />);

    fill('0', '30');

    expect(nextButton().disabled).toBe(true);
  });

  it('keeps Next disabled when the price is only filled and the size is empty', () => {
    render(<PreguntaInicio6 />);

    fill('150', '');

    expect(nextButton().disabled).toBe(true);
  });
});
