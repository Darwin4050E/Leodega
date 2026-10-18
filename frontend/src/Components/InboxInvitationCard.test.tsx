import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InboxInvitationCard from './InboxInvitationCard';
import { RESPOND_ACTION } from '../utils/invitationCopy';
import type { InboxInvitation } from '../services/organizations';

const DAY_MS = 24 * 60 * 60 * 1000;

function invitation(overrides: Partial<InboxInvitation> = {}): InboxInvitation {
  return {
    id: 4,
    organization_id: 7,
    organization_name: 'Importadora Andina S.A.',
    invited_by_name: 'María López',
    role: 'member',
    status: 'pending',
    expires_at: new Date(Date.now() + 5 * DAY_MS).toISOString(),
    created_at: '2026-06-08T12:00:00Z',
    responded_at: null,
    can_respond: true,
    ...overrides,
  };
}

function renderCard(item: InboxInvitation, busyAction: 'accept' | 'reject' | null = null) {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  render(<InboxInvitationCard invitation={item} busyAction={busyAction} onAccept={onAccept} onReject={onReject} />);
  return { onAccept, onReject };
}

describe('InboxInvitationCard', () => {
  describe('pending item', () => {
    it('WS69: shows the eyebrow, organization, inviter, badge, info block and the two buttons', () => {
      renderCard(invitation());

      const card = screen.getByRole('article');
      expect(within(card).getByText('Te invitaron a unirte')).toBeInTheDocument();
      expect(within(card).getByRole('heading', { name: 'Importadora Andina S.A.' })).toBeInTheDocument();
      expect(within(card).getByText('Invitada por María López')).toBeInTheDocument();
      expect(within(card).getByText('Pendiente')).toBeInTheDocument();
      expect(within(card).getByText('Rol')).toBeInTheDocument();
      expect(within(card).getByText('Miembro')).toBeInTheDocument();
      expect(within(card).getByText('Al aceptar podrás')).toBeInTheDocument();
      expect(within(card).getByText('Reservar a nombre de la empresa')).toBeInTheDocument();
      expect(within(card).getByText('Vence')).toBeInTheDocument();
      expect(within(card).getByText('en 5 días')).toBeInTheDocument();
    });

    it('WS69: renders Rechazar before Aceptar invitación', () => {
      renderCard(invitation());

      const buttons = screen.getAllByRole('button');

      expect(buttons.map((button) => button.textContent)).toEqual(['Rechazar', 'Aceptar invitación']);
    });

    it('calls onAccept and onReject from their own buttons', async () => {
      const { onAccept, onReject } = renderCard(invitation());

      await userEvent.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onReject).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
      expect(onReject).toHaveBeenCalledTimes(1);
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('WS70: omits the inviter line when invited_by_name is null', () => {
      renderCard(invitation({ invited_by_name: null }));

      expect(screen.queryByText(/Invitada por/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Importadora Andina S.A.' })).toBeInTheDocument();
    });

    it('WS71: reads en 5 días five days ahead and en 1 día for one day or less', () => {
      const { unmount } = render(
        <InboxInvitationCard
          invitation={invitation({ expires_at: new Date(Date.now() + 5 * DAY_MS).toISOString() })}
          busyAction={null}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />,
      );
      expect(screen.getByText('en 5 días')).toBeInTheDocument();
      unmount();

      renderCard(invitation({ expires_at: new Date(Date.now() + DAY_MS / 2).toISOString() }));
      expect(screen.getByText('en 1 día')).toBeInTheDocument();
      expect(screen.queryByText('en 5 días')).not.toBeInTheDocument();
    });

    it('WS78: a client clock past expires_at with a server-pending item stays pending as en 1 día', () => {
      renderCard(invitation({ expires_at: new Date(Date.now() - 3 * DAY_MS).toISOString() }));

      expect(screen.getByText('Pendiente')).toBeInTheDocument();
      expect(screen.getByText('en 1 día')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aceptar invitación' })).toBeEnabled();
      expect(screen.queryByText('Expirada')).not.toBeInTheDocument();
    });

    it('WS75: renders no action button when can_respond is false', () => {
      renderCard(invitation({ can_respond: false }));

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.getByText('Pendiente')).toBeInTheDocument();
    });

    it('WS82: shows the organization initials mark computed with organizationInitials', () => {
      renderCard(invitation({ organization_name: 'Importadora Andina S.A.' }));
      expect(screen.getByText('IA')).toBeInTheDocument();
    });

    it('WS82: another organization name gives its own initials', () => {
      renderCard(invitation({ organization_name: 'Norte Cía. Ltda.' }));
      expect(screen.getByText('NC')).toBeInTheDocument();
      expect(screen.queryByText('IA')).not.toBeInTheDocument();
    });
  });

  describe('in flight', () => {
    it('WS84: accepting shows Aceptando... and makes both buttons inert', () => {
      renderCard(invitation(), RESPOND_ACTION.ACCEPT);

      expect(screen.getByRole('button', { name: 'Aceptando...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
      expect(screen.queryByText('Aceptar invitación')).not.toBeInTheDocument();
    });

    it('WS86: rejecting shows Rechazando... and makes both buttons inert', () => {
      renderCard(invitation(), RESPOND_ACTION.REJECT);

      expect(screen.getByRole('button', { name: 'Rechazando...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Aceptar invitación' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    });

    it('keeps both buttons enabled when nothing is in flight', () => {
      renderCard(invitation());

      expect(screen.getByRole('button', { name: 'Aceptar invitación' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    });
  });

  describe('expired item', () => {
    const expired = () => invitation({ status: 'expired', can_respond: false, organization_name: 'Importadora Andina S.A.' });

    it('WS72: shows Expirada, the unavailable notice with the short name and no action buttons', () => {
      renderCard(expired());

      expect(screen.getByText('Expirada')).toBeInTheDocument();
      expect(screen.getByText('Esta invitación ya no está disponible')).toBeInTheDocument();
      expect(
        screen.getByText('La invitación expiró. Pide al administrador de Importadora Andina que te envíe una nueva.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByText('Aceptar invitación')).not.toBeInTheDocument();
      expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
      expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
    });

    it('WS73: never renders Solicitar nueva invitación, pending or expired', () => {
      const { unmount } = render(
        <InboxInvitationCard invitation={expired()} busyAction={null} onAccept={vi.fn()} onReject={vi.fn()} />,
      );
      expect(screen.queryByText('Solicitar nueva invitación')).not.toBeInTheDocument();
      unmount();

      renderCard(invitation());
      expect(screen.queryByText('Solicitar nueva invitación')).not.toBeInTheDocument();
    });

    it('does not show the role, permission and expiry info block', () => {
      renderCard(expired());

      expect(screen.queryByText('Al aceptar podrás')).not.toBeInTheDocument();
      expect(screen.queryByText('Vence')).not.toBeInTheDocument();
    });

    it('WS76: {short} is whatever organizationShortName returns for the name', () => {
      renderCard({ ...expired(), organization_name: 'Norte Cía. Ltda.' });

      expect(
        screen.getByText('La invitación expiró. Pide al administrador de Norte que te envíe una nueva.'),
      ).toBeInTheDocument();
    });

    it('keeps the inviter line and the greyed initials mark', () => {
      renderCard(expired());

      expect(screen.getByText('Invitada por María López')).toBeInTheDocument();
      expect(screen.getByText('IA')).toBeInTheDocument();
    });
  });
});
