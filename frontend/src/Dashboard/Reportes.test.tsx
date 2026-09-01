import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Reportes from './Reportes';

const mockGetReports = vi.hoisted(() => vi.fn());

vi.mock('../services/reports', () => ({
  getReports: mockGetReports,
}));

const sampleReports = [
  {
    id: 1,
    user: { name: 'Juan Pérez', email: 'juan@test.com' },
    store: { direction: 'Av. Principal 123' },
    created_at: '2026-01-15T10:00:00Z',
    report_type: 'Seguridad',
    status: 'pending',
  },
  {
    id: 2,
    user: { name: 'María López', email: 'maria@test.com' },
    store: { direction: 'Calle Falsa 456' },
    created_at: '2026-02-20T10:00:00Z',
    report_type: 'Acceso',
    status: 'resolved',
  },
];

describe('Reportes', () => {
  beforeEach(() => {
    mockGetReports.mockReset();
  });

  it('shows a loading state before the reports arrive', () => {
    mockGetReports.mockReturnValue(new Promise(() => {}));
    render(<Reportes />);
    expect(screen.getByText('Cargando reportes...')).toBeInTheDocument();
  });

  it('fetches and renders reports with the mapped estado label', async () => {
    mockGetReports.mockResolvedValue({ data: sampleReports });
    render(<Reportes />);

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.getByText('En proceso', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Completada', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('00001')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 reportes')).toBeInTheDocument();
  });

  it('filters rows by the tipo select', async () => {
    mockGetReports.mockResolvedValue({ data: sampleReports });
    render(<Reportes />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByDisplayValue('Tipo'), 'Acceso');

    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 reportes')).toBeInTheDocument();
  });

  it('reiniciar filtros clears an active tipo filter', async () => {
    mockGetReports.mockResolvedValue({ data: sampleReports });
    render(<Reportes />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.selectOptions(screen.getByDisplayValue('Tipo'), 'Acceso');
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();

    await user.click(screen.getByText('Reiniciar'));

    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
  });

  it('logs and stops loading when the fetch fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetReports.mockRejectedValue(new Error('network error'));

    render(<Reportes />);

    await waitFor(() =>
      expect(screen.queryByText('Cargando reportes...')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Mostrando 0 reportes')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Error cargando reportes', expect.any(Error));

    consoleError.mockRestore();
  });
});
