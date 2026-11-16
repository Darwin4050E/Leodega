import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGetNotifications = vi.hoisted(() => vi.fn());
const mockMarkNotificationRead = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSelectOrganization = vi.hoisted(() => vi.fn());
const mockSelectPersonal = vi.hoisted(() => vi.fn());
const mockActivateOrganization = vi.hoisted(() => vi.fn());

vi.mock('../context/useActiveContext', () => ({
  useActiveContext: () => ({
    selectOrganization: mockSelectOrganization,
    selectPersonal: mockSelectPersonal,
    activateOrganization: mockActivateOrganization,
  }),
}));

vi.mock('../services/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/notifications')>();
  return {
    ...actual,
    getNotifications: mockGetNotifications,
    markNotificationRead: mockMarkNotificationRead,
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import NotificationsDropdown from './NotificatiosnDropdown';

const paidWithData = {
  id: 1,
  title: 'Bodega reservada y pagada',
  body: 'Tu bodega fue reservada y el pago quedó confirmado',
  type: 'reservation_booked_and_paid',
  is_read: false,
  data: {
    reservation_id: 10,
    store_room_id: 20,
    customer_name: 'Ana Torres',
    store_room_title: 'Bodega Norte',
    amount: '3000.00',
    start_date: '2026-02-01',
    end_date: '2026-05-01',
  },
};

const legacyPaidNoData = {
  id: 2,
  title: 'Bodega reservada y pagada',
  body: 'Tu bodega fue reservada y el pago quedó confirmado',
  type: 'reservation_booked_and_paid',
  is_read: true,
  data: { reservation_id: 11, store_room_id: 21 },
};

const expiredWithData = {
  id: 3,
  title: 'Reserva expirada',
  body: 'El cliente no completó el pago a tiempo; la bodega volvió a estar disponible.',
  type: 'reservation_expired',
  is_read: false,
  data: {
    reservation_id: 12,
    store_room_id: 22,
    customer_name: 'Luis Pérez',
    store_room_title: 'Bodega Sur',
    start_date: '2026-03-01',
    end_date: '2026-03-10',
  },
};

const expiredNoData = {
  id: 4,
  title: 'Reserva expirada',
  body: 'El cliente no completó el pago a tiempo; la bodega volvió a estar disponible.',
  type: 'reservation_expired',
  is_read: true,
  data: null,
};

const paidOrgData = {
  id: 5,
  title: 'Bodega reservada y pagada',
  body: 'Tu bodega fue reservada y el pago quedó confirmado',
  type: 'reservation_booked_and_paid',
  is_read: false,
  data: {
    reservation_id: 13,
    store_room_id: 23,
    customer_name: 'Ana Torres',
    store_room_title: 'Bodega Centro',
    amount: '1500.00',
    start_date: '2026-04-01',
    end_date: '2026-06-01',
    organization_name: 'Andina',
    organization_ruc: '1792146739001',
  },
};

describe('NotificationsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkNotificationRead.mockResolvedValue({});
  });

  it('renders structured data for a paid-booking notification with full data', async () => {
    mockGetNotifications.mockResolvedValue({ data: [paidWithData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('Bodega Norte')).toBeInTheDocument();
    expect(screen.getByText(/\$3,000/)).toBeInTheDocument();
  });

  it('falls back to the static body for a legacy notification missing structured data', async () => {
    mockGetNotifications.mockResolvedValue({ data: [legacyPaidNoData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText(legacyPaidNoData.body)).toBeInTheDocument();
  });

  it('navigates to /arrendador/solicitudes when a paid-booking notification is clicked', async () => {
    mockGetNotifications.mockResolvedValue({ data: [paidWithData] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await screen.findByText('Ana Torres');

    await user.click(screen.getByText('Ana Torres'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/arrendador/solicitudes'));
  });

  it('calls mark-as-read once for an unread notification and not again when already read', async () => {
    mockGetNotifications.mockResolvedValue({ data: [paidWithData, legacyPaidNoData] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await screen.findByText('Ana Torres');

    await user.click(screen.getByText('Ana Torres'));
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(1);

    mockMarkNotificationRead.mockClear();
    await user.click(screen.getByText(legacyPaidNoData.body));
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('renders structured data for an expired-hold notification with full data', async () => {
    mockGetNotifications.mockResolvedValue({ data: [expiredWithData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(screen.getByText('Bodega Sur')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-01/)).toBeInTheDocument();
  });

  it('falls back to the static body for an expired-hold notification missing structured data', async () => {
    mockGetNotifications.mockResolvedValue({ data: [expiredNoData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText(expiredNoData.body)).toBeInTheDocument();
  });

  it('navigates to /arrendador/solicitudes when an expired-hold notification is clicked', async () => {
    mockGetNotifications.mockResolvedValue({ data: [expiredWithData] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await screen.findByText('Luis Pérez');

    await user.click(screen.getByText('Luis Pérez'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/arrendador/solicitudes'));
  });

  // HUE-05 OR-WS13/WS14
  it('shows the organization name for a paid-booking notification carrying one', async () => {
    mockGetNotifications.mockResolvedValue({ data: [paidOrgData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText(/Andina/)).toBeInTheDocument();
  });

  it('shows no organization line for a paid-booking notification without one', async () => {
    mockGetNotifications.mockResolvedValue({ data: [paidWithData] });

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);

    expect(await screen.findByText('Ana Torres')).toBeInTheDocument();
    expect(screen.queryByText(/Andina/)).not.toBeInTheDocument();
  });

  // HUC-14 INV-W7: the HUE-01 no-navigation characterization is rewritten in place.
  it('INV-WS55: an organization_invitation click marks it read, closes the dropdown and opens the invitee inbox', async () => {
    const invitation = {
      id: 6,
      title: 'Te invitaron a unirte a una organización',
      body: 'Ana Pérez te invitó a unirte a Andina como miembro.',
      type: 'organization_invitation',
      is_read: false,
      data: { invitation_id: 3, organization_id: 7 },
    };
    mockGetNotifications.mockResolvedValue({ data: [invitation] });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} onClose={onClose} />);
    expect(await screen.findByText(invitation.title)).toBeInTheDocument();
    expect(screen.getByText(invitation.body)).toBeInTheDocument();

    await user.click(screen.getByText(invitation.title));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/mi-cuenta/invitaciones'));
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(6);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('WS121: an unknown future type shows title and body and neither navigates nor closes', async () => {
    const unknown = { id: 9, title: 'Algo nuevo', body: 'Detalle', type: 'something_new', is_read: true, data: null };
    mockGetNotifications.mockResolvedValue({ data: [unknown] });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} onClose={onClose} />);
    await user.click(await screen.findByText('Algo nuevo'));

    expect(screen.getByText('Detalle')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['organization_invitation_accepted', 'Invitación aceptada', 'Ana Pérez se unió a la organización Andina.'],
    [
      'organization_invitation_rejected',
      'Invitación rechazada',
      'ana@example.com rechazó la invitación a unirse a Andina.',
    ],
  ])('WS122 WS123 WS125: %s renders as stored and opens the members page', async (type, title, body) => {
    const notification = { id: 11, title, body, type, is_read: false, data: { invitation_id: 3, organization_id: 7 } };
    mockGetNotifications.mockResolvedValue({ data: [notification] });
    const onUnreadChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={onUnreadChange} onClose={onClose} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();

    await user.click(screen.getByText(title));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/organizacion/miembros'));
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(11);
    expect(onUnreadChange).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('WS124: following an admin response notification never touches the active context', async () => {
    const notification = {
      id: 12,
      title: 'Invitación aceptada',
      body: 'Detalle',
      type: 'organization_invitation_accepted',
      is_read: true,
      data: { invitation_id: 3, organization_id: 99 },
    };
    mockGetNotifications.mockResolvedValue({ data: [notification] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await user.click(await screen.findByText('Invitación aceptada'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/organizacion/miembros'));
    expect(mockSelectOrganization).not.toHaveBeenCalled();
    expect(mockSelectPersonal).not.toHaveBeenCalled();
    expect(mockActivateOrganization).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'corrupted'],
    ['an array', [1, 2]],
  ])('WS126: navigation survives data that is %s', async (_label, data) => {
    const notification = {
      id: 13,
      title: 'Invitación rechazada',
      body: 'Detalle',
      type: 'organization_invitation_rejected',
      is_read: true,
      data,
    };
    mockGetNotifications.mockResolvedValue({ data: [notification] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await user.click(await screen.findByText('Invitación rechazada'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/organizacion/miembros'));
  });

  it('WS127: store_reported keeps navigating to the admin requests', async () => {
    const reported = { id: 14, title: 'Bodega reportada', body: 'x', type: 'store_reported', is_read: true, data: null };
    mockGetNotifications.mockResolvedValue({ data: [reported] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await user.click(await screen.findByText('Bodega reportada'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/solicitudes'));
  });

  it('the onClose prop is optional: clicking a navigable notification without it still navigates', async () => {
    mockGetNotifications.mockResolvedValue({ data: [expiredNoData] });
    const user = userEvent.setup();

    render(<NotificationsDropdown onUnreadChange={vi.fn()} />);
    await user.click(await screen.findByText(expiredNoData.body));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/arrendador/solicitudes'));
  });
});
