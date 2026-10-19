import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PanelMembersTable from './PanelMembersTable';
import { PANEL_STATUS, type PanelStatus } from '../hooks/useOrganizationPanel';
import type { PanelMember } from '../services/organizations';

const ADMIN_ROWS: PanelMember[] = [
  {
    user_id: 1,
    name: 'Ana Pérez',
    role: 'admin',
    joined_at: '2026-06-08T12:00:00Z',
    is_self: true,
    email: 'ana@acme.test',
    monthly_limit: '100.00',
    spent: '40.00',
  },
  {
    user_id: 2,
    name: 'Luis Mora',
    role: 'member',
    joined_at: '2026-07-15T12:00:00Z',
    is_self: false,
    email: 'luis@acme.test',
    monthly_limit: null,
    spent: '25.50',
  },
];

// A member caller: peers carry no email, limit or spent; the own row carries limit and spent.
const MEMBER_ROWS: PanelMember[] = [
  { user_id: 1, name: 'Ana Pérez', role: 'admin', joined_at: '2026-06-08T12:00:00Z', is_self: false },
  {
    user_id: 2,
    name: 'Luis Mora',
    role: 'member',
    joined_at: '2026-07-15T12:00:00Z',
    is_self: true,
    monthly_limit: '50.00',
    spent: '10.00',
  },
  { user_id: 3, name: 'Eva Ríos', role: 'member', joined_at: null, is_self: false },
];

interface RenderOptions {
  status?: PanelStatus;
  members?: PanelMember[] | null;
  isAdmin?: boolean;
  onRetry?: () => void;
}

function renderTable({
  status = PANEL_STATUS.READY,
  members = ADMIN_ROWS,
  isAdmin = true,
  onRetry = vi.fn(),
}: RenderOptions = {}) {
  return render(
    <MemoryRouter>
      <PanelMembersTable status={status} members={members} isAdmin={isAdmin} onRetry={onRetry} />
    </MemoryRouter>,
  );
}

const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('PanelMembersTable', () => {
  describe('admin view', () => {
    it('WS29 / WS77: a named table with scoped column headers and the admin subtitle', () => {
      renderTable();

      const table = screen.getByRole('table', { name: 'Miembros' });
      const headers = within(table).getAllByRole('columnheader');
      expect(headers.map((header) => header.textContent)).toEqual(['Miembro', 'Límite mensual', 'Consumido este mes']);
      headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
      expect(screen.getByText('Límite de gasto mensual por miembro · se reinicia el día 1 de cada mes')).toBeInTheDocument();
    });

    it('WS29: shows name, role badge, email, join date, limit and consumed with percentage and bar', () => {
      renderTable();

      const row = within(rowOf('Ana Pérez'));
      expect(row.getByText('Administrador')).toBeInTheDocument();
      expect(row.getByText(/ana@acme\.test/)).toBeInTheDocument();
      expect(row.getByText(/desde 08 jun 2026/)).toBeInTheDocument();
      expect(row.getByText('$100.00 /mes')).toBeInTheDocument();
      expect(row.getByText('$40.00 de $100.00')).toBeInTheDocument();
      expect(row.getByText('40%')).toBeInTheDocument();
      expect(row.getByRole('progressbar')).toHaveStyle({ width: '40%' });
    });

    it('caps the bar at 100% when the member went over the limit', () => {
      renderTable({
        members: [{ ...ADMIN_ROWS[0], monthly_limit: '10.00', spent: '25.00' }],
      });

      expect(screen.getByRole('progressbar')).toHaveStyle({ width: '100%' });
      expect(screen.getByText('250%')).toBeInTheDocument();
    });

    it('WS30: a null limit shows Sin límite and the amount with the no-cap suffix, without a bar', () => {
      renderTable();

      const row = within(rowOf('Luis Mora'));
      expect(row.getByText('Miembro')).toBeInTheDocument();
      expect(row.getByText('Sin límite')).toBeInTheDocument();
      expect(row.getByText('$25.50')).toBeInTheDocument();
      expect(row.getByText('· sin tope')).toBeInTheDocument();
      expect(row.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('WS31: marks the own row with the self marker and no other row', () => {
      renderTable();

      expect(within(rowOf('Ana Pérez')).getByText('· tú')).toBeInTheDocument();
      expect(within(rowOf('Luis Mora')).queryByText('· tú')).not.toBeInTheDocument();
    });

    it('WS34 / WS67: the admin gets the Invitar and Gestionar límites links, and no destructive control', () => {
      renderTable();

      expect(screen.getByRole('link', { name: 'Invitar' })).toHaveAttribute('href', '/organizacion/miembros');
      expect(screen.getByRole('link', { name: 'Gestionar límites' })).toHaveAttribute('href', '/organizacion/billetera');
      expect(screen.queryByRole('button', { name: /quitar|editar|eliminar/i })).not.toBeInTheDocument();
    });

    it('WS35: a null join date omits the desde text', () => {
      renderTable({ members: [{ ...ADMIN_ROWS[1], joined_at: null }] });

      const row = within(rowOf('Luis Mora'));
      expect(row.getByText('luis@acme.test')).toBeInTheDocument();
      expect(screen.queryByText(/desde/)).not.toBeInTheDocument();
    });

    it('WS63: a creator-only organization renders one row', () => {
      renderTable({ members: [ADMIN_ROWS[0]] });

      const table = screen.getByRole('table', { name: 'Miembros' });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
    });
  });

  describe('member view', () => {
    it('WS33: shows the member subtitle and no admin links', () => {
      renderTable({ members: MEMBER_ROWS, isAdmin: false });

      expect(screen.getByText('Solo ves tu propio consumo mensual')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Invitar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Gestionar límites' })).not.toBeInTheDocument();
    });

    it('WS32 / WS55: rows without hidden keys render no email, no limit or consumed cells, and no dash or zero', () => {
      renderTable({ members: MEMBER_ROWS, isAdmin: false });

      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
      const peer = rowOf('Ana Pérez');
      const cells = within(peer).getAllByRole('cell');
      expect(cells).toHaveLength(2);
      expect(cells[1]).toHaveAttribute('colspan', '2');
      expect(cells[1]).toBeEmptyDOMElement();
      expect(peer.textContent).not.toMatch(/[—–-]|\b0\b|\$/);
      expect(within(peer).getByText('Administrador')).toBeInTheDocument();
      expect(within(peer).getByText(/desde 08 jun 2026/)).toBeInTheDocument();
    });

    it('WS33: the own row shows its limit and consumed amount', () => {
      renderTable({ members: MEMBER_ROWS, isAdmin: false });

      const own = within(rowOf('Luis Mora'));
      expect(own.getByText('· tú')).toBeInTheDocument();
      expect(own.getByText('$50.00 /mes')).toBeInTheDocument();
      expect(own.getByText('$10.00 de $50.00')).toBeInTheDocument();
      expect(own.getByText('20%')).toBeInTheDocument();
    });

    it('WS35: a row with a null join date shows the name only', () => {
      renderTable({ members: MEMBER_ROWS, isAdmin: false });

      expect(rowOf('Eva Ríos').textContent).toBe('Eva RíosMiembro');
    });
  });

  describe('states', () => {
    it('WS35 / WS61: an error shows the members error with Reintentar wired to the section reload', async () => {
      const onRetry = vi.fn();
      renderTable({ status: PANEL_STATUS.ERROR, members: null, onRetry });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los miembros');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('WS27 / WS78: loading shows the polite status text and no table', () => {
      renderTable({ status: PANEL_STATUS.LOADING, members: null });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Miembros' })).toBeInTheDocument();
    });

    it('idle and forbidden render nothing', () => {
      const idle = renderTable({ status: PANEL_STATUS.IDLE, members: null });
      expect(idle.container).toBeEmptyDOMElement();
      idle.unmount();

      const forbidden = renderTable({ status: PANEL_STATUS.FORBIDDEN, members: null });
      expect(forbidden.container).toBeEmptyDOMElement();
    });

    it('an empty list shows the heading and no table', () => {
      renderTable({ members: [] });

      expect(screen.getByRole('heading', { level: 2, name: 'Miembros' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
