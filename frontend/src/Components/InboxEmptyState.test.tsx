import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InboxEmptyState from './InboxEmptyState';
import { EMPTY_VARIANT } from './inboxEmptyVariant';

describe('InboxEmptyState', () => {
  it('WS67: the plain variant reads No tienes invitaciones with its hint', () => {
    render(<InboxEmptyState variant={EMPTY_VARIANT.PLAIN} />);

    expect(screen.getByRole('heading', { name: 'No tienes invitaciones' })).toBeInTheDocument();
    expect(screen.getByText('Cuando una empresa te invite, aparecerá aquí.')).toBeInTheDocument();
    expect(screen.queryByText('No tienes invitaciones pendientes')).not.toBeInTheDocument();
  });

  it('WS109: the post-reject variant reads No tienes invitaciones pendientes with the reject explanation', () => {
    render(<InboxEmptyState variant={EMPTY_VARIANT.REJECTED} />);

    expect(screen.getByRole('heading', { name: 'No tienes invitaciones pendientes' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Rechazaste la invitación. No hubo ningún cambio en tu cuenta y seguirás operando en modo personal.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cuando una empresa te invite, aparecerá aquí.')).not.toBeInTheDocument();
  });
});
