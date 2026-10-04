import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from './SearchBar';

const CITY_LABELS = [
  'Todas las ciudades',
  'Quito',
  'Guayaquil',
  'Cuenca',
  'Ambato',
  'Manta',
  'Machala',
  'Loja',
  'Santo Domingo',
];

describe('SearchBar', () => {
  it('renders a labelled city select with 9 options and no free-text location input', () => {
    render(<SearchBar onSearch={vi.fn()} />);

    const select = screen.getByLabelText('Ubicación') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(CITY_LABELS);
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      '',
      ...CITY_LABELS.slice(1),
    ]);
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: 'Todas las ciudades' })).toHaveProperty('selected', true);
    expect(screen.queryByPlaceholderText('Busca según tu ubicación')).not.toBeInTheDocument();
  });

  it('emits an empty city by default', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith({ city: '', minSize: '', minPrice: '', maxPrice: '' });
  });

  it('emits the selected city together with the other fields, only on Buscar', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Quito' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '15' } });
    fireEvent.change(screen.getByPlaceholderText('Mín.'), { target: { value: '30' } });
    fireEvent.change(screen.getByPlaceholderText('Máx.'), { target: { value: '90' } });
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onSearch).toHaveBeenCalledWith({
      city: 'Quito',
      minSize: '15',
      minPrice: '30',
      maxPrice: '90',
    });
  });

  it('shows an error and does not emit when the max price is below the min price', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByPlaceholderText('Mín.'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('Máx.'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(
      screen.getByText('El precio máximo debe ser mayor o igual al precio mínimo.')
    ).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('keeps the entered values after searching', () => {
    render(<SearchBar onSearch={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Cuenca' } });
    fireEvent.change(screen.getByPlaceholderText('Ej. 10'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect((screen.getByLabelText('Ubicación') as HTMLSelectElement).value).toBe('Cuenca');
    expect((screen.getByPlaceholderText('Ej. 10') as HTMLInputElement).value).toBe('12');
  });
});
