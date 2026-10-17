import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InvitationsList from './InvitationsList';
import { INVITATIONS_STATUS } from '../hooks/useOrganizationInvitations';
import { InvitationStatus, type OrganizationInvitation } from '../services/organizations';

function invitation(overrides: Partial<OrganizationInvitation> = {}): OrganizationInvitation {
  return {
    id: 1,
    email: 'ana@x.com',
    status: InvitationStatus.PENDING,
    expires_at: '2026-06-15T12:00:00.000000Z',
    created_at: '2026-06-08T12:00:00.000000Z',
    responded_at: null,
    invited_by_name: 'María López',
    can_be_revoked: true,
    ...overrides,
  };
}

function renderList(overrides: Partial<React.ComponentProps<typeof InvitationsList>> = {}) {
  const props = {
    status: INVITATIONS_STATUS.READY as React.ComponentProps<typeof InvitationsList>['status'],
    items: [invitation()],
    page: 1,
    lastPage: 1,
    total: 1,
    pendingCount: 1,
    revokingId: null as number | null,
    onRevoke: vi.fn(),
    onPageChange: vi.fn(),
    ...overrides,
  };
  render(<InvitationsList {...props} />);
  return props;
}

describe('InvitationsList', () => {
  it('WS32: shows the heading and a counter built from pending_count and total, not from the page rows', () => {
    renderList({ items: [invitation()], total: 25, pendingCount: 2 });

    expect(screen.getByRole('heading', { name: 'Invitaciones' })).toBeInTheDocument();
    expect(screen.getByText('2 pendientes · 25 en total')).toBeInTheDocument();
  });

  it('WS25: shows Cargando invitaciones… while loading, without the empty state', () => {
    renderList({ status: INVITATIONS_STATUS.LOADING, items: [], total: 0, pendingCount: 0 });

    expect(screen.getByText('Cargando invitaciones…')).toBeInTheDocument();
    expect(screen.queryByText('Aún no has enviado invitaciones.')).not.toBeInTheDocument();
  });

  it('WS26: shows the empty state with a zero counter', () => {
    renderList({ items: [], total: 0, pendingCount: 0 });

    expect(screen.getByText('Aún no has enviado invitaciones.')).toBeInTheDocument();
    expect(screen.getByText('0 pendientes · 0 en total')).toBeInTheDocument();
  });

  it('WS27: shows No pudimos cargar las invitaciones as an alert on error', () => {
    renderList({ status: INVITATIONS_STATUS.ERROR, items: [] });

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las invitaciones');
  });

  it('WS29/WS30/WS31: a pending row shows email, sent date, expiry and inviter', () => {
    renderList();

    const row = screen.getByRole('listitem');
    expect(within(row).getByText('ana@x.com')).toBeInTheDocument();
    expect(row).toHaveTextContent('enviada 08 jun 2026 · vence 15 jun 2026 · invitada por María López');
    expect(within(row).getByText('Pendiente')).toBeInTheDocument();
  });

  it('WS30/WS31: a non-pending row has no expiry, and a null inviter omits the fragment', () => {
    renderList({
      items: [invitation({ status: InvitationStatus.ACCEPTED, invited_by_name: null, can_be_revoked: false })],
    });

    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('enviada 08 jun 2026');
    expect(row).not.toHaveTextContent('vence');
    expect(row).not.toHaveTextContent('invitada por');
    expect(within(row).getByText('Aceptada')).toBeInTheDocument();
  });

  it('WS33: Revocar renders only where can_be_revoked is true, whatever the dates say', () => {
    renderList({
      items: [
        invitation({ id: 1, email: 'a@x.com', can_be_revoked: true }),
        invitation({ id: 2, email: 'b@x.com', can_be_revoked: false }),
        invitation({
          id: 3,
          email: 'c@x.com',
          status: InvitationStatus.PENDING,
          expires_at: '2020-01-01T00:00:00.000000Z',
          can_be_revoked: false,
        }),
      ],
      total: 3,
    });

    expect(screen.getAllByRole('button', { name: 'Revocar' })).toHaveLength(1);
    expect(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
  });

  it('click on Revocar reports the invitation id with no dialog', async () => {
    const user = userEvent.setup();
    const { onRevoke } = renderList({ items: [invitation({ id: 9 })] });

    await user.click(screen.getByRole('button', { name: 'Revocar' }));

    expect(onRevoke).toHaveBeenCalledExactlyOnceWith(9);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('WS35: the row being revoked is inert and labelled Revocando..., other rows keep Revocar', () => {
    renderList({
      items: [invitation({ id: 1, email: 'a@x.com' }), invitation({ id: 2, email: 'b@x.com' })],
      total: 2,
      revokingId: 1,
    });

    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByRole('button', { name: 'Revocando...' })).toBeDisabled();
    expect(within(second).getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
  });

  it('WS34: keeps the server order', () => {
    renderList({
      items: [
        invitation({ id: 5, email: 'zeta@x.com' }),
        invitation({ id: 6, email: 'alfa@x.com' }),
      ],
      total: 2,
    });

    const emails = screen.getAllByRole('listitem').map((row) => row.textContent ?? '');
    expect(emails[0]).toContain('zeta@x.com');
    expect(emails[1]).toContain('alfa@x.com');
  });

  it('WS42: hides the pagination when there is a single page', () => {
    renderList({ lastPage: 1 });

    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
  });

  it('WS43: page 1 of 3 disables Anterior and enables Siguiente', () => {
    renderList({ page: 1, lastPage: 3, total: 50 });

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('WS44: Siguiente and Anterior request the neighbouring page', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderList({ page: 2, lastPage: 3, total: 50 });

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('WS45: Siguiente is disabled on the last page', () => {
    renderList({ page: 3, lastPage: 3, total: 50 });

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('WS49: after a failed page change the error shows and the controls stay usable', async () => {
    const user = userEvent.setup();
    const { onPageChange } = renderList({ status: INVITATIONS_STATUS.ERROR, items: [], page: 2, lastPage: 3, total: 50 });

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las invitaciones');
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
