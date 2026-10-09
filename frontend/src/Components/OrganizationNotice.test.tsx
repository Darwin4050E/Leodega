import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import OrganizationNotice from './OrganizationNotice';

describe('OrganizationNotice', () => {
  it('renders "Reservando como {name}" with the name in bold', () => {
    render(<OrganizationNotice name="Andina" />);

    const bold = screen.getByText('Andina');
    expect(bold.tagName).toBe('B');
    expect(screen.getByText(/Reservando como/)).toBeInTheDocument();
  });

  it('renders a different organization name verbatim (triangulation)', () => {
    render(<OrganizationNotice name="Logística del Pacífico" />);

    expect(screen.getByText('Logística del Pacífico').tagName).toBe('B');
  });
});
