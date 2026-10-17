import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InviteMemberForm from './InviteMemberForm';
import { NOTICE_TONE, type InviteNotice } from '../utils/inviteNotice';

function renderForm(overrides: Partial<React.ComponentProps<typeof InviteMemberForm>> = {}) {
  const props = {
    organizationName: 'Acme S.A.',
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    notice: null as InviteNotice | null,
    ...overrides,
  };
  render(<InviteMemberForm {...props} />);
  return props;
}

describe('InviteMemberForm', () => {
  it('WS11: renders the title, subtitle with the organization, label, placeholder, helper and button', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Invitar miembros' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Suma clientes a Acme S.A. buscándolos por correo. Tú decides quién puede reservar en nombre de la empresa.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar usuario por correo')).toHaveAttribute('placeholder', 'nombre@correo.com');
    expect(screen.getByText('Solo clientes pueden unirse; los gestores de bodega no.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar invitación' })).toBeEnabled();
  });

  it('WS24: the input is associated with its label and is a controlled field', () => {
    const { onChange } = renderForm({ value: 'ana@x.com' });

    const input = screen.getByLabelText('Buscar usuario por correo');
    expect(input).toHaveValue('ana@x.com');
    fireEvent.change(input, { target: { value: 'ana@x.co' } });
    expect(onChange).toHaveBeenCalledWith('ana@x.co');
  });

  it('WS14: the button and the Enter key each request one submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ value: '  ana@x.com ' });

    await user.click(screen.getByRole('button', { name: 'Enviar invitación' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText('Buscar usuario por correo'), '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('WS15: while submitting the button is disabled and labelled Enviando...', () => {
    renderForm({ submitting: true });

    const button = screen.getByRole('button', { name: 'Enviando...' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Enviar invitación' })).not.toBeInTheDocument();
  });

  it('WS24: an error notice is an alert with its title and body, and flags the input', () => {
    renderForm({ notice: { tone: NOTICE_TONE.ERROR, title: 'No puedes invitar a este correo', body: 'Texto del servidor' } });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No puedes invitar a este correo');
    expect(alert).toHaveTextContent('Texto del servidor');
    expect(screen.getByLabelText('Buscar usuario por correo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('WS16/WS24: a success notice is a status, not an alert', () => {
    renderForm({
      notice: {
        tone: NOTICE_TONE.SUCCESS,
        title: 'Invitación enviada',
        body: 'Le avisamos a ana@x.com en su cuenta de cliente. Aparecerá en su bandeja de invitaciones.',
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Invitación enviada');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar usuario por correo')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('renders no notice container when there is no notice', () => {
    renderForm();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('a notice title without a body renders only the title', () => {
    renderForm({ notice: { tone: NOTICE_TONE.ERROR, title: 'No se pudo enviar la invitación. Intenta nuevamente.' } });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo enviar la invitación. Intenta nuevamente.');
  });
});
