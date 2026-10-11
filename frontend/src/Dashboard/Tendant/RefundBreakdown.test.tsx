import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import RefundBreakdown from './RefundBreakdown';

function renderBreakdown(overrides: Partial<Parameters<typeof RefundBreakdown>[0]> = {}) {
  return render(
    <RefundBreakdown
      totalAmount="100.00"
      penaltyAmount="50.00"
      refundAmount="50.00"
      organizationName="Andina"
      {...overrides}
    />
  );
}

describe('RefundBreakdown', () => {
  it('OR-WS30: shows the three lines with the preview amounts', () => {
    renderBreakdown();

    expect(screen.getByText('Total pagado').closest('div')).toHaveTextContent('Total pagado$100.00');
    expect(screen.getByText('Penalización').closest('div')).toHaveTextContent('Penalización$50.00');
    expect(screen.getByText('Reembolso').closest('div')).toHaveTextContent('Reembolso$50.00');
  });

  it('OR-WS31: names the org wallet as the destination in the shipped $ USD format (spec literal $50.00 deviates, design O1)', () => {
    renderBreakdown();

    expect(screen.getByText(/se acreditará al saldo de Andina\./)).toHaveTextContent(
      'El reembolso de $50 USD se acreditará al saldo de Andina.'
    );
  });

  it('OR-WS32: shows the zero-refund line instead of the destination notice when the refund is 0', () => {
    renderBreakdown({ penaltyAmount: '100.00', refundAmount: '0.00' });

    expect(screen.getByText('Esta cancelación no genera reembolso.')).toBeInTheDocument();
    expect(screen.queryByText(/se acreditará al saldo/)).not.toBeInTheDocument();
    expect(screen.getByText('Reembolso').closest('div')).toHaveTextContent('Reembolso$0.00');
  });

  it('shows neither the prototype fee nor deposit lines', () => {
    renderBreakdown();

    expect(screen.queryByText(/tarifa|comisión|depósito|deposito/i)).not.toBeInTheDocument();
  });
});
