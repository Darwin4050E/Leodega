import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import CancelReasonField from './CancelReasonField';
import { REASON_MAX, REASON_MIN, reasonLength } from './cancelReason';

function Harness({
  initial = '',
  touched = false,
  serverError = '',
  onChangeSpy,
}: {
  initial?: string;
  touched?: boolean;
  serverError?: string;
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CancelReasonField
      value={value}
      touched={touched}
      serverError={serverError}
      onChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
      onBlur={vi.fn()}
    />
  );
}

describe('reasonLength', () => {
  it('counts the trimmed value by code points, not UTF-16 units', () => {
    expect(reasonLength('  hola  ')).toBe(4);
    expect(reasonLength('😀😀')).toBe(2);
    expect(reasonLength('   ')).toBe(0);
    expect(REASON_MIN).toBe(10);
    expect(REASON_MAX).toBe(200);
  });
});

describe('CancelReasonField', () => {
  it('OR-WS22: renders the exact label, placeholder and helper copy', () => {
    render(<Harness />);

    const textarea = screen.getByLabelText('Motivo de la cancelación *');
    expect(textarea).toHaveAttribute('placeholder', 'Explica por qué se cancela esta reserva…');
    expect(screen.getByText('Obligatorio · queda en el historial de la empresa.')).toBeInTheDocument();
  });

  it('OR-WS23: counts the trimmed length and turns green only from 10 characters', () => {
    render(<Harness />);
    const textarea = screen.getByLabelText('Motivo de la cancelación *');

    fireEvent.change(textarea, { target: { value: '  hola  ' } });
    expect(screen.getByText('4 / 10 mín.')).not.toHaveClass('text-green-600');

    fireEvent.change(textarea, { target: { value: '  1234567890  ' } });
    expect(screen.getByText('10 / 10 mín.')).toHaveClass('text-green-600');
  });

  it('OR-WS25: shows the inline error only when touched and invalid', () => {
    const { rerender } = render(
      <CancelReasonField value="corto" touched={false} serverError="" onChange={vi.fn()} onBlur={vi.fn()} />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<CancelReasonField value="corto" touched serverError="" onChange={vi.fn()} onBlur={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('El motivo debe tener al menos 10 caracteres.');
    expect(screen.getByLabelText('Motivo de la cancelación *')).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <CancelReasonField value="un motivo valido" touched serverError="" onChange={vi.fn()} onBlur={vi.fn()} />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('OR-WS28: shows the server error even when the field is valid and untouched', () => {
    render(
      <CancelReasonField
        value="un motivo valido"
        touched={false}
        serverError="El motivo no puede superar los 200 caracteres."
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('El motivo no puede superar los 200 caracteres.');
  });

  it('OR-WS26: cuts pasted text at 200 characters', () => {
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    fireEvent.change(screen.getByLabelText('Motivo de la cancelación *'), { target: { value: 'a'.repeat(250) } });

    expect(onChangeSpy).toHaveBeenCalledWith('a'.repeat(200));
    expect(screen.getByLabelText('Motivo de la cancelación *')).toHaveValue('a'.repeat(200));
  });

  it('cuts by code points so astral characters are not split', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Motivo de la cancelación *'), { target: { value: '😀'.repeat(250) } });

    expect(screen.getByLabelText('Motivo de la cancelación *')).toHaveValue('😀'.repeat(200));
  });
});
