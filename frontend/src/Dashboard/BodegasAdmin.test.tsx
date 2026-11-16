import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetStoreRooms = vi.hoisted(() => vi.fn());
vi.mock('../services/storeRooms', () => ({ getStoreRooms: mockGetStoreRooms }));
vi.mock('./BodegaDetalle', () => ({ default: () => null }));

import BodegasAdmin from './BodegasAdmin';

describe('BodegasAdmin copy', () => {
  it('shows the search and sort controls in Spanish', async () => {
    mockGetStoreRooms.mockResolvedValue({ data: [] });
    render(<BodegasAdmin />);
    await waitFor(() => expect(mockGetStoreRooms).toHaveBeenCalled());

    expect(screen.getByPlaceholderText('Buscar')).toBeInTheDocument();
    expect(screen.getByText('Ordenar por:')).toBeInTheDocument();
    expect(screen.getByText('Más recientes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Más recientes'));
    expect(screen.getByText('Más antiguos')).toBeInTheDocument();
    expect(screen.getByText('Nombre A-Z')).toBeInTheDocument();
  });
});
