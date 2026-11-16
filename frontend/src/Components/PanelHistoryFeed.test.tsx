import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PanelHistoryFeed from './PanelHistoryFeed';
import { PANEL_STATUS, type PanelStatus } from '../hooks/useOrganizationPanel';
import { PANEL_HISTORY_KIND, type PaginatedPanelHistory, type PanelHistoryEntry } from '../services/organizations';

// Built from local fields so the rendered date does not depend on the machine time zone.
const LOCAL_INSTANT = new Date(2026, 5, 8, 9, 12).toISOString();

function entry(overrides: Partial<PanelHistoryEntry> = {}): PanelHistoryEntry {
  return {
    id: 'reservation_created:1',
    kind: PANEL_HISTORY_KIND.RESERVATION_CREATED,
    occurred_at: LOCAL_INSTANT,
    actor_name: 'Ana Pérez',
    target_label: 'Bodega Norte',
    amount: null,
    ...overrides,
  };
}

function paginator(rows: PanelHistoryEntry[], overrides: Partial<PaginatedPanelHistory> = {}) {
  return { data: rows, current_page: 1, last_page: 1, per_page: 20, total: rows.length, ...overrides };
}

interface RenderOptions {
  status?: PanelStatus;
  history?: PaginatedPanelHistory | null;
  page?: number;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
}

function renderFeed({
  status = PANEL_STATUS.READY,
  history = paginator([entry()]),
  page = 1,
  onPageChange = vi.fn(),
  onRetry = vi.fn(),
}: RenderOptions = {}) {
  return render(
    <PanelHistoryFeed status={status} history={history} page={page} onPageChange={onPageChange} onRetry={onRetry} />,
  );
}

const rows = () => screen.getAllByRole('listitem');

// Lucide marks every icon with a class named after the glyph.
const iconClass = (row: HTMLElement) => row.querySelector('svg')?.getAttribute('class') ?? '';
const iconBadge = (row: HTMLElement) => row.querySelector('svg')?.parentElement as HTMLElement;

describe('PanelHistoryFeed', () => {
  describe('structure', () => {
    it('WS44: a named section with the title and subtitle, and one list item per entry', () => {
      renderFeed({ history: paginator([entry(), entry({ id: 'member_joined:2', kind: PANEL_HISTORY_KIND.MEMBER_JOINED })]) });

      const section = screen.getByRole('region', { name: 'Historial de acciones' });
      expect(within(section).getByRole('heading', { level: 2, name: 'Historial de acciones' })).toBeInTheDocument();
      expect(within(section).getByText('Reservas, billetera y miembros — con fecha y autor')).toBeInTheDocument();
      expect(within(section).getByRole('list')).toBeInTheDocument();
      expect(rows()).toHaveLength(2);
    });

    it('keeps the server order of the entries', () => {
      renderFeed({
        history: paginator([
          entry({ id: 'wallet_refund:3', kind: PANEL_HISTORY_KIND.WALLET_REFUND, amount: '90.00' }),
          entry({ id: 'reservation_cancelled:2', kind: PANEL_HISTORY_KIND.RESERVATION_CANCELLED }),
          entry({ id: 'reservation_created:1' }),
        ]),
      });

      expect(rows().map((row) => row.textContent)).toEqual([
        expect.stringContaining('Se reembolsaron $90.00'),
        expect.stringContaining('canceló la reserva'),
        expect.stringContaining('reservó'),
      ]);
    });
  });

  describe('kinds', () => {
    it('WS45: a created reservation shows the sentence with the actor and the warehouse in bold and a calendar icon', () => {
      renderFeed();

      const [row] = rows();
      expect(row).toHaveTextContent('Ana Pérez reservó Bodega Norte');
      expect(within(row).getByText('Ana Pérez').tagName).toBe('STRONG');
      expect(within(row).getByText('Bodega Norte').tagName).toBe('STRONG');
      expect(iconClass(row)).toContain('lucide-calendar');
    });

    it('WS46: a cancelled reservation shows an x icon in the error tone', () => {
      renderFeed({ history: paginator([entry({ kind: PANEL_HISTORY_KIND.RESERVATION_CANCELLED })]) });

      const [row] = rows();
      expect(row).toHaveTextContent('Ana Pérez canceló la reserva de Bodega Norte');
      expect(iconClass(row)).toMatch(/lucide-x\b/);
      expect(iconBadge(row).className).toContain('text-red-600');
    });

    it('WS47: a top-up shows the amount and a dollar icon', () => {
      renderFeed({
        history: paginator([entry({ kind: PANEL_HISTORY_KIND.WALLET_TOPUP, target_label: null, amount: '150.00' })]),
      });

      const [row] = rows();
      expect(row).toHaveTextContent('Ana Pérez recargó la billetera con $150.00');
      expect(iconClass(row)).toContain('lucide-dollar-sign');
    });

    it('WS48: a refund shows the amount and the warehouse', () => {
      renderFeed({
        history: paginator([entry({ kind: PANEL_HISTORY_KIND.WALLET_REFUND, actor_name: null, amount: '90.00' })]),
      });

      expect(rows()[0]).toHaveTextContent('Se reembolsaron $90.00 a la billetera por la reserva de Bodega Norte');
    });

    it('WS49: a member joining shows a user icon', () => {
      renderFeed({ history: paginator([entry({ kind: PANEL_HISTORY_KIND.MEMBER_JOINED, target_label: null })]) });

      const [row] = rows();
      expect(row).toHaveTextContent('Ana Pérez se unió a la organización');
      expect(iconClass(row)).toMatch(/lucide-user\b/);
    });

    it('WS50: an unknown future kind renders a neutral clock row with a generic line and does not crash', () => {
      renderFeed({ history: paginator([entry({ id: 'x:1', kind: 'reservation_extended' })]) });

      const [row] = rows();
      expect(row).toHaveTextContent('Actividad registrada en la organización');
      expect(iconClass(row)).toContain('lucide-clock');
      expect(iconBadge(row).className).toContain('text-gray-500');
    });
  });

  describe('fallbacks and date-time', () => {
    it('WS51: null actor and null warehouse use the approved fallbacks', () => {
      renderFeed({ history: paginator([entry({ actor_name: null, target_label: null })]) });

      expect(rows()[0]).toHaveTextContent('Un usuario que ya no está reservó una bodega que ya no está disponible');
    });

    it('WS51: every row shows the date and time of the event', () => {
      renderFeed({
        history: paginator([entry(), entry({ id: 'member_joined:2', kind: PANEL_HISTORY_KIND.MEMBER_JOINED })]),
      });

      rows().forEach((row) => {
        const time = within(row).getByRole('time');
        expect(time).toHaveTextContent('08 jun 2026 · 09:12');
        expect(time).toHaveAttribute('datetime', LOCAL_INSTANT);
      });
    });
  });

  describe('states', () => {
    it('WS52: an empty feed shows the empty text and no pagination', () => {
      renderFeed({ history: paginator([]) });

      expect(screen.getByText('Aún no hay actividad en la empresa.')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('WS52: more than one page shows the shared pagination and reports the requested page', async () => {
      const onPageChange = vi.fn();
      renderFeed({ history: paginator([entry()], { last_page: 3 }), page: 2, onPageChange });

      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('WS52: a failure shows the history error with a retry that is wired to this section', async () => {
      const onRetry = vi.fn();
      renderFeed({ status: PANEL_STATUS.ERROR, history: null, onRetry });

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar el historial');
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('WS58 / WS64: loading shows a polite status and keeps the heading', () => {
      renderFeed({ status: PANEL_STATUS.LOADING, history: null });

      expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
      expect(screen.getByRole('heading', { level: 2, name: 'Historial de acciones' })).toBeInTheDocument();
    });

    it.each([PANEL_STATUS.IDLE, PANEL_STATUS.FORBIDDEN])('WS52: %s renders nothing at all', (status) => {
      const { container } = renderFeed({ status, history: null });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('read-only', () => {
    it('WS66: offers no control other than retry and pagination', () => {
      renderFeed({ history: paginator([entry()], { last_page: 2 }) });

      screen.getAllByRole('button').forEach((button) => {
        expect(button).toHaveAccessibleName(/anterior|siguiente/i);
      });
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});
