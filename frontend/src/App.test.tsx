import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./Components/login', () => ({
  default: () => <div>Pantalla de inicio de sesión</div>,
}));
vi.mock('./Dashboard/Tendant/PagePrincipal', () => ({
  default: () => <div>Panel del arrendatario</div>,
}));
vi.mock('./Dashboard/Mensajes', () => ({
  default: () => <div>Mensajes del arrendatario</div>,
}));
vi.mock('./Dashboard/Tendant/CalendarioTendant', () => ({
  default: () => <div>Calendario del arrendatario</div>,
}));
vi.mock('./Dashboard/Tendant/MisReservas', () => ({
  default: () => <div>Mis reservas</div>,
}));

import App from './App';

/**
 * sdd/tenant-reservations-screen, spec "Modified — tenant route auth
 * guard": all four /arrendatario/* routes MUST be declared inside
 * <Protected> (App.tsx:129-131 area). Exercises the REAL App.tsx route
 * tree (not a reimplementation) via jsdom's window.location + the app's
 * own BrowserRouter, controlling the session through the same
 * localStorage keys AuthProvider reads (auth_token/auth_user) -- no
 * context mocking needed.
 */
function visit(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

const TENANT_ROUTES: [string, string][] = [
  ['/arrendatario/dashboard', 'Panel del arrendatario'],
  ['/arrendatario/mensajes', 'Mensajes del arrendatario'],
  ['/arrendatario/calendario', 'Calendario del arrendatario'],
  ['/arrendatario/mis-reservas', 'Mis reservas'],
];

describe('tenant routes auth guard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it.each(TENANT_ROUTES)(
    'redirects an unauthenticated visitor from %s to login instead of the page shell',
    (path, marker) => {
      visit(path);

      expect(screen.queryByText(marker)).not.toBeInTheDocument();
      expect(screen.getByText('Pantalla de inicio de sesión')).toBeInTheDocument();
    }
  );

  it.each(TENANT_ROUTES)('renders %s for an authenticated session', (path, marker) => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, role: 'tenant' }));

    visit(path);

    expect(screen.getByText(marker)).toBeInTheDocument();
  });
});
