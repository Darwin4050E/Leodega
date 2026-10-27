import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetReport = vi.hoisted(() => vi.fn());
const mockUpdateReportStatus = vi.hoisted(() => vi.fn());
vi.mock('../services/reports', () => ({
  getReport: mockGetReport,
  updateReportStatus: mockUpdateReportStatus,
}));

import SolicitudRevisarResponder from './SolicitudRevisarResponder';

const solicitud = { id: 7, nombre: 'Juan', tipo: 'Daño', fecha: '2026-01-01', estado: 'Pendiente', direccion: 'Calle 1' };

describe('SolicitudRevisarResponder resolution copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReport.mockResolvedValue({ data: {} });
  });

  const renderIt = () =>
    render(
      <SolicitudRevisarResponder
        solicitud={solicitud as never}
        onVolver={vi.fn()}
        onRechazar={vi.fn()}
      />,
    );

  it('offers "Marcar como completada" and keeps "Rechazar Reporte"', async () => {
    renderIt();
    expect(await screen.findByText('Marcar como completada')).toBeInTheDocument();
    expect(screen.queryByText('Marcar como Resuelto')).not.toBeInTheDocument();
    expect(screen.getByText('Rechazar Reporte')).toBeInTheDocument();
  });

  it('uses the same wording in the confirm screen', async () => {
    renderIt();
    fireEvent.click(await screen.findByText('Marcar como completada'));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Resolución/ }));
    expect(screen.getAllByText('Marcar como completada')).toHaveLength(2);
    expect(screen.getByText('completada', { selector: 'b' })).toBeInTheDocument();
  });
});
