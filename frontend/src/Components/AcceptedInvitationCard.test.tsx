import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AcceptedInvitationCard from './AcceptedInvitationCard';
import type { Organization } from '../services/organizations';

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 7,
    name: 'Importadora Andina S.A.',
    ruc: '1790012345001',
    email: 'info@andina.com',
    logo: null,
    status: 'active',
    role: 'member',
    ...overrides,
  };
}

function renderCard(org: Organization = organization()) {
  const onStayPersonal = vi.fn();
  const onOperateAs = vi.fn();
  render(<AcceptedInvitationCard organization={org} onStayPersonal={onStayPersonal} onOperateAs={onOperateAs} />);
  return { onStayPersonal, onOperateAs };
}

describe('AcceptedInvitationCard', () => {
  it('WS95: shows the joined title with the short name, the body, the organization row and the badge', () => {
    renderCard();

    const card = screen.getByRole('status');
    expect(within(card).getByRole('heading', { name: 'Te uniste a Importadora Andina' })).toBeInTheDocument();
    expect(within(card).getByText('Rol: Miembro')).toBeInTheDocument();
    expect(within(card).getByText('Unido')).toBeInTheDocument();
    expect(within(card).getByText('IA')).toBeInTheDocument();
  });

  it('WS95/IC-68: the body carries the full organization name in bold', () => {
    renderCard();

    const bold = screen.getByText('Importadora Andina S.A.', { selector: 'b' });
    expect(bold).toBeInTheDocument();
    expect(bold.parentElement).toHaveTextContent(
      'Ya eres miembro de Importadora Andina S.A.. El selector de contexto, arriba a la derecha, ahora te deja operar en su nombre.',
    );
  });

  it('WS95: renders Seguir en personal before Operar como {short}', () => {
    renderCard();

    const buttons = screen.getAllByRole('button');

    expect(buttons.map((button) => button.textContent)).toEqual(['Seguir en personal', 'Operar como Importadora Andina']);
  });

  it('wires each button to its own handler', async () => {
    const { onStayPersonal, onOperateAs } = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Operar como Importadora Andina' }));
    expect(onOperateAs).toHaveBeenCalledTimes(1);
    expect(onStayPersonal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Seguir en personal' }));
    expect(onStayPersonal).toHaveBeenCalledTimes(1);
    expect(onOperateAs).toHaveBeenCalledTimes(1);
  });

  it('WS79: the confirmation is announced as a status, never as an alert', () => {
    renderCard();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the short name of whatever organization came back from the accept call', () => {
    renderCard(organization({ id: 9, name: 'Norte Cía. Ltda.' }));

    expect(screen.getByRole('heading', { name: 'Te uniste a Norte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Operar como Norte' })).toBeInTheDocument();
    expect(screen.getByText('NC')).toBeInTheDocument();
  });
});
