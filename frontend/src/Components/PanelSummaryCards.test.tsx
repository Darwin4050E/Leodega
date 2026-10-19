import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PANEL_STATUS } from '../hooks/useOrganizationPanel';
import type { PanelSummary } from '../services/organizations';
import PanelSummaryCards from './PanelSummaryCards';

const ADMIN_SUMMARY: PanelSummary = {
  organization_id: 7,
  role: 'admin',
  members_count: 3,
  active_reservations_count: 2,
  pending_invitations_count: 1,
};

const MEMBER_SUMMARY: PanelSummary = {
  organization_id: 7,
  role: 'member',
  members_count: 3,
  active_reservations_count: 2,
};

function renderCards(overrides: Partial<ComponentProps<typeof PanelSummaryCards>> = {}) {
  const onRetry = vi.fn();
  render(<PanelSummaryCards status={PANEL_STATUS.READY} summary={ADMIN_SUMMARY} onRetry={onRetry} {...overrides} />);
  return { onRetry };
}

describe('PanelSummaryCards', () => {
  describe('ready', () => {
    it('WS18: an admin sees the three cards with their values and sub-labels', () => {
      renderCards();

      const members = screen.getByRole('group', { name: 'Miembros activos' });
      expect(within(members).getByText('3')).toBeInTheDocument();
      expect(within(members).getByText('Incluido el administrador')).toBeInTheDocument();

      const reservations = screen.getByRole('group', { name: 'Reservas vigentes' });
      expect(within(reservations).getByText('2')).toBeInTheDocument();
      expect(within(reservations).getByText('A nombre de la organización')).toBeInTheDocument();

      const pending = screen.getByRole('group', { name: 'Invitaciones pendientes' });
      expect(within(pending).getByText('1')).toBeInTheDocument();
      expect(within(pending).getByText('Esperando respuesta')).toBeInTheDocument();
    });

    it('WS19: a member sees exactly two cards and no pending-invitations card', () => {
      renderCards({ summary: MEMBER_SUMMARY });

      expect(screen.getAllByRole('group')).toHaveLength(2);
      expect(screen.queryByText('Invitaciones pendientes')).not.toBeInTheDocument();
    });

    it('WS20: a member reservations card says the reservations were made by them', () => {
      renderCards({ summary: MEMBER_SUMMARY });

      const reservations = screen.getByRole('group', { name: 'Reservas vigentes' });
      expect(within(reservations).getByText('Hechas por ti')).toBeInTheDocument();
      expect(screen.queryByText('A nombre de la organización')).not.toBeInTheDocument();
    });

    it('keeps a real zero visible as 0 once the summary is ready', () => {
      renderCards({
        summary: { ...ADMIN_SUMMARY, members_count: 1, active_reservations_count: 0, pending_invitations_count: 0 },
      });

      expect(screen.getByRole('group', { name: 'Reservas vigentes' })).toHaveTextContent('0');
      expect(screen.getByRole('group', { name: 'Invitaciones pendientes' })).toHaveTextContent('0');
    });
  });

  describe('loading', () => {
    it('WS21 / WS64: shows a polite status text and no zeros posing as real data', () => {
      renderCards({ status: PANEL_STATUS.LOADING, summary: null });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  describe('error', () => {
    it('WS22 / WS64: shows the summary error as an alert with a retry that only calls the summary reload', async () => {
      const { onRetry } = renderCards({ status: PANEL_STATUS.ERROR, summary: null });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar el resumen');
      expect(screen.queryByRole('group')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('not applicable states', () => {
    it.each([[PANEL_STATUS.IDLE], [PANEL_STATUS.FORBIDDEN]])('renders nothing when the status is %s', (status) => {
      const { container } = render(<PanelSummaryCards status={status} summary={null} onRetry={vi.fn()} />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
