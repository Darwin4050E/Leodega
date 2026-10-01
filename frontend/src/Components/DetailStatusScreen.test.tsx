import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DetailStatusScreen from './DetailStatusScreen';

describe('DetailStatusScreen', () => {
  it('renders the not-found copy for the not-found variant', () => {
    render(<DetailStatusScreen variant="not-found" onBack={vi.fn()} />);

    expect(
      screen.getByText('Esta bodega no existe o ya no está disponible')
    ).toBeInTheDocument();
  });

  it('renders a distinct copy for the error variant', () => {
    render(<DetailStatusScreen variant="error" onBack={vi.fn()} />);

    expect(
      screen.getByText(
        'No se pudo cargar la información de esta bodega. Verifica tu conexión e inténtalo de nuevo.'
      )
    ).toBeInTheDocument();
  });

  it('labels the not-found back button "← Volver al catálogo" (HUC-02 S3)', () => {
    render(<DetailStatusScreen variant="not-found" onBack={vi.fn()} />);

    expect(screen.getByRole('button', { name: '← Volver al catálogo' })).toBeInTheDocument();
  });

  it('keeps the generic "← Volver" label for the error variant', () => {
    render(<DetailStatusScreen variant="error" onBack={vi.fn()} />);

    expect(screen.getByRole('button', { name: '← Volver' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← Volver al catálogo' })).not.toBeInTheDocument();
  });

  it('renders a loading indicator for the loading variant', () => {
    render(<DetailStatusScreen variant="loading" onBack={vi.fn()} />);

    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('calls onBack when the back link is clicked', () => {
    const onBack = vi.fn();
    render(<DetailStatusScreen variant="not-found" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
