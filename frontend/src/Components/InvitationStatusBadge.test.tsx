import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import InvitationStatusBadge from './InvitationStatusBadge';
import { InvitationStatus } from '../services/organizations';

describe('InvitationStatusBadge', () => {
  it.each([
    [InvitationStatus.PENDING, 'Pendiente'],
    [InvitationStatus.ACCEPTED, 'Aceptada'],
    [InvitationStatus.REJECTED, 'Rechazada'],
    [InvitationStatus.EXPIRED, 'Expirada'],
    [InvitationStatus.CANCELLED, 'Cancelada'],
  ])('WS28: %s renders the label %s', (status, label) => {
    render(<InvitationStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('uses a distinct tone for pending, accepted and rejected and a shared neutral tone for expired and cancelled', () => {
    const toneOf = (status: InvitationStatus, label: string) => {
      const { unmount } = render(<InvitationStatusBadge status={status} />);
      const className = screen.getByText(label).className;
      unmount();
      return className;
    };

    const pending = toneOf(InvitationStatus.PENDING, 'Pendiente');
    const accepted = toneOf(InvitationStatus.ACCEPTED, 'Aceptada');
    const rejected = toneOf(InvitationStatus.REJECTED, 'Rechazada');
    const expired = toneOf(InvitationStatus.EXPIRED, 'Expirada');
    const cancelled = toneOf(InvitationStatus.CANCELLED, 'Cancelada');

    expect(new Set([pending, accepted, rejected, expired]).size).toBe(4);
    expect(expired).toBe(cancelled);
  });
});
