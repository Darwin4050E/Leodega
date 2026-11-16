import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PanelReservationsTable from './PanelReservationsTable';
import { PANEL_STATUS, type PanelStatus } from '../hooks/useOrganizationPanel';
import type { PaginatedPanelReservations, PanelReservation } from '../services/organizations';

const ROW: PanelReservation = {
  id: 11,
  warehouse_name: 'Bodega Norte',
  member_name: 'Ana Pérez',
  start_date: '2026-11-01',
  end_date: '2026-11-30',
  status: 'confirmed',
  total: '120.00',
  paid_with_wallet: true,
};

function paginator(rows: PanelReservation[], overrides: Partial<PaginatedPanelReservations> = {}) {
  return { data: rows, current_page: 1, last_page: 1, per_page: 20, total: rows.length, ...overrides };
}

interface RenderOptions {
  status?: PanelStatus;
  reservations?: PaginatedPanelReservations | null;
  isAdmin?: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
}

function renderTable({
  status = PANEL_STATUS.READY,
  reservations = paginator([ROW]),
  isAdmin = true,
  page = 1,
  onPageChange = vi.fn(),
  onRetry = vi.fn(),
}: RenderOptions = {}) {
  return render(
    <MemoryRouter>
      <PanelReservationsTable
        status={status}
        reservations={reservations}
        isAdmin={isAdmin}
        page={page}
        onPageChange={onPageChange}
        onRetry={onRetry}
      />
    </MemoryRouter>,
  );
}

const cellsOfRow = (index: number) =>
  within(screen.getAllByRole('row')[index]).getAllByRole('cell').map((cell) => cell.textContent);

describe('PanelReservationsTable', () => {
  describe('rows', () => {
    it('WS36 / WS77: a named table with scoped headers and one row per reservation', () => {
      renderTable();

      const table = screen.getByRole('table', { name: 'Reservas a nombre de la empresa' });
      const headers = within(table).getAllByRole('columnheader');
      expect(headers.map((header) => header.textContent)).toEqual([
        'Bodega',
        'Miembro',
        'Período',
        'Monto',
        'Pagado con saldo',
        'Estado',
      ]);
      headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
      expect(cellsOfRow(1)).toEqual(['Bodega Norte', 'Ana Pérez', '01 nov — 30 nov', '$120.00', '$120.00', 'Activa']);
      expect(screen.getByText(/Visibles para ti y los administradores/)).toBeInTheDocument();
    });

    it('WS37: a pending reservation reads Pendiente', () => {
      renderTable({ reservations: paginator([{ ...ROW, status: 'pending' }]) });

      expect(cellsOfRow(1)[5]).toBe('Pendiente');
    });

    it('WS38: a reservation not paid with the wallet reads Tarjeta in the paid cell', () => {
      renderTable({ reservations: paginator([{ ...ROW, paid_with_wallet: false }]) });

      expect(cellsOfRow(1)).toEqual(['Bodega Norte', 'Ana Pérez', '01 nov — 30 nov', '$120.00', 'Tarjeta', 'Activa']);
    });

    it('WS39: absent amount and paid keys render a dash, never NaN or undefined', () => {
      const hidden = { ...ROW } as Partial<PanelReservation>;
      delete hidden.total;
      delete hidden.paid_with_wallet;

      renderTable({ reservations: paginator([hidden as PanelReservation]) });

      expect(cellsOfRow(1)).toEqual(['Bodega Norte', 'Ana Pérez', '01 nov — 30 nov', '—', '—', 'Activa']);
      expect(document.body).not.toHaveTextContent(/NaN|undefined/);
    });

    it('WS43: a missing warehouse or member shows a neutral dash', () => {
      renderTable({ reservations: paginator([{ ...ROW, warehouse_name: null, member_name: null }]) });

      expect(cellsOfRow(1).slice(0, 2)).toEqual(['—', '—']);
    });

    it('the member view reads its own subtitle', () => {
      renderTable({ isAdmin: false });

      expect(screen.getByText(/Solo ves las reservas que hiciste/)).toBeInTheDocument();
      expect(screen.queryByText(/Visibles para todos/)).not.toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('WS40: shows the controls for several pages and requests only the page asked for', async () => {
      const onPageChange = vi.fn();
      renderTable({ reservations: paginator([ROW], { last_page: 3 }), page: 2, onPageChange });

      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

      expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);
    });

    it('WS40: no controls for a single page', () => {
      renderTable();

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('empty state and links', () => {
    it('WS41: an admin with no reservations sees the admin text and no pagination', () => {
      renderTable({ reservations: paginator([]) });

      expect(
        screen.getByText('Aún no hay reservas a nombre de la empresa. Reserva en contexto de empresa desde el catálogo.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
    });

    it('WS41: a member with no reservations sees the member text', () => {
      renderTable({ reservations: paginator([]), isAdmin: false });

      expect(screen.getByText('Aún no tienes reservas a nombre de la empresa.')).toBeInTheDocument();
    });

    it('WS42: every role gets the link to their own reservations', () => {
      renderTable({ isAdmin: false });

      expect(screen.getByRole('link', { name: 'Ver mis reservas' })).toHaveAttribute('href', '/arrendatario/mis-reservas');
    });

    it('offers no cancel or edit control on a row', () => {
      renderTable();

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText(/cancelar|editar/i)).not.toBeInTheDocument();
    });
  });

  describe('loading and error', () => {
    it('WS78: loading is a polite status without a table', () => {
      renderTable({ status: PANEL_STATUS.LOADING, reservations: null });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows the error as an alert and Reintentar calls the retry', async () => {
      const onRetry = vi.fn();
      renderTable({ status: PANEL_STATUS.ERROR, reservations: null, onRetry });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las reservas');
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(onRetry).toHaveBeenCalledOnce();
    });

    it.each([PANEL_STATUS.IDLE, PANEL_STATUS.FORBIDDEN])('renders nothing while %s', (status) => {
      const { container } = renderTable({ status, reservations: null });

      expect(container).toBeEmptyDOMElement();
    });
  });
});
