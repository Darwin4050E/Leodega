import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockGetOrganizations = vi.hoisted(() => vi.fn());

vi.mock('../services/organizations', () => ({
  getOrganizations: mockGetOrganizations,
}));

import { AuthProvider } from './AuthContext';
import { ActiveContextProvider } from './ActiveContext';
import { useActiveContext } from './useActiveContext';
import { useAuth } from './useAuth';
import type { AuthUser } from './authContextBase';
import { forcePersonalContext } from '../utils/activeContext';
import type { Organization } from '../services/organizations';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <ActiveContextProvider>{children}</ActiveContextProvider>
  </AuthProvider>
);

function organization(id: number, overrides = {}) {
  return {
    id,
    name: `Organización ${id}`,
    ruc: '1790012345001',
    email: 'ops@example.com',
    logo: null,
    status: 'active',
    role: 'admin',
    ...overrides,
  };
}

function authUser(id: number, role: AuthUser['role'] = 'tenant'): AuthUser {
  return { id, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', role };
}

function seedSession(user: AuthUser) {
  localStorage.setItem('auth_token', 'tok');
  localStorage.setItem('auth_user', JSON.stringify(user));
}

function renderContext() {
  return renderHook(() => ({ active: useActiveContext(), auth: useAuth() }), { wrapper });
}

const PERSONAL = { kind: 'personal' };
const organizationContext = (organizationId: number) => ({ kind: 'organization', organizationId });

describe('ActiveContextProvider hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });
  });

  it('resolves the stored organization on the very first render, before the list loads', () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockReturnValue(new Promise(() => {}));
    const seen: unknown[] = [];
    const Probe = () => {
      seen.push(useActiveContext().context);
      return null;
    };

    render(
      <AuthProvider>
        <ActiveContextProvider>
          <Probe />
        </ActiveContextProvider>
      </AuthProvider>,
    );

    expect(seen[0]).toEqual(organizationContext(7));
  });

  it('starts personal when there is no session', () => {
    const { result } = renderContext();

    expect(result.current.active.context).toEqual(PERSONAL);
  });

  it.each(['abc', '0', '{"x":1}', '01', '99999999999999999999'])(
    'treats the stored value %j as personal',
    (stored) => {
      seedSession(authUser(5));
      localStorage.setItem('active_context:5', stored);
      mockGetOrganizations.mockReturnValue(new Promise(() => {}));

      const { result } = renderContext();

      expect(result.current.active.context).toEqual(PERSONAL);
    },
  );

  it('never reads the key of another user', () => {
    seedSession(authUser(6));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockReturnValue(new Promise(() => {}));

    const { result } = renderContext();

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });

  it('re-derives the context when another user logs in without logging out first', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    expect(result.current.active.context).toEqual(organizationContext(7));

    act(() => result.current.auth.login('tok-6', authUser(6)));

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(localStorage.getItem('active_context:5')).toBe('7');
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
  });

  it('keeps the next user key untouched across the logout then login of the login flow', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    localStorage.setItem('active_context:6', '8');
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => {
      result.current.auth.logout();
      result.current.auth.login('tok-6', authUser(6));
    });

    expect(localStorage.getItem('active_context:6')).toBe('8');
    expect(result.current.active.context).toEqual(organizationContext(8));
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
  });

  it('resets to personal after logout', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => result.current.auth.logout());

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(result.current.active.enabled).toBe(false);
  });
});

describe('ActiveContextProvider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });
    seedSession(authUser(5));
  });

  it('persists the decimal id when an organization is selected', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => result.current.active.selectOrganization(7));

    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(result.current.active.context).toEqual(organizationContext(7));
    expect(result.current.active.activeOrganization?.name).toBe('Organización 7');
  });

  it('switches between organizations and removes the key for personal', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => result.current.active.selectOrganization(7));
    act(() => result.current.active.selectOrganization(8));
    expect(localStorage.getItem('active_context:5')).toBe('8');
    expect(result.current.active.activeOrganization?.name).toBe('Organización 8');

    act(() => result.current.active.selectPersonal());

    expect(localStorage.getItem('active_context:5')).toBeNull();
    expect(result.current.active.context).toEqual(PERSONAL);
    expect(result.current.active.activeOrganization).toBeNull();
  });
});

describe('ActiveContextProvider organization list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the list once for a tenant: loading, then ready', async () => {
    seedSession(authUser(5));
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });

    const { result } = renderContext();

    expect(result.current.active.enabled).toBe(true);
    expect(result.current.active.status).toBe('loading');
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    expect(result.current.active.organizations.map((item) => item.id)).toEqual([7, 8]);
    expect(mockGetOrganizations).toHaveBeenCalledTimes(1);
  });

  it('keeps every organization selectable regardless of its status', async () => {
    seedSession(authUser(5));
    mockGetOrganizations.mockResolvedValue({
      data: [organization(7), organization(8, { status: 'suspended' })],
    });
    localStorage.setItem('active_context:5', '8');

    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    expect(result.current.active.organizations.map((item) => item.id)).toEqual([7, 8]);
    expect(result.current.active.context).toEqual(organizationContext(8));
  });

  it.each(['landlord', 'admin'] as const)('does not fetch for a %s', (role) => {
    seedSession(authUser(5, role));

    const { result } = renderContext();

    expect(result.current.active.enabled).toBe(false);
    expect(result.current.active.status).toBe('idle');
    expect(mockGetOrganizations).not.toHaveBeenCalled();
  });

  it('does not fetch for an anonymous visitor', () => {
    const { result } = renderContext();

    expect(result.current.active.enabled).toBe(false);
    expect(mockGetOrganizations).not.toHaveBeenCalled();
  });

  it('exposes the error status, still renders children and keeps the stored context', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockRejectedValue(new Error('boom'));

    render(
      <AuthProvider>
        <ActiveContextProvider>
          <p>contenido de la página</p>
        </ActiveContextProvider>
      </AuthProvider>,
    );

    expect(screen.getByText('contenido de la página')).toBeInTheDocument();
    await waitFor(() => expect(mockGetOrganizations).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.getByText('contenido de la página')).toBeInTheDocument();
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });

  it('reports status error and keeps the stored organization when the fetch fails', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockRejectedValue(new Error('boom'));

    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('error'));

    expect(result.current.active.context).toEqual(organizationContext(7));
    expect(result.current.active.activeOrganization).toBeNull();
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });

  it('treats a response that is not a list as an error', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockResolvedValue({ data: { message: 'unexpected' } });

    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('error'));

    expect(result.current.active.context).toEqual(organizationContext(7));
  });

  it('recovers from an error when the list is reloaded', async () => {
    seedSession(authUser(5));
    mockGetOrganizations.mockRejectedValueOnce(new Error('boom'));
    mockGetOrganizations.mockResolvedValueOnce({ data: [organization(7)] });
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('error'));

    act(() => result.current.active.reloadOrganizations());

    expect(result.current.active.status).toBe('loading');
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    expect(result.current.active.organizations.map((item) => item.id)).toEqual([7]);
    expect(mockGetOrganizations).toHaveBeenCalledTimes(2);
  });

  it('falls back to personal and removes the key when the stored organization is not in the list', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockResolvedValue({ data: [organization(1), organization(2)] });

    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(localStorage.getItem('active_context:5')).toBeNull();
  });

  it('keeps the stored organization when it is in the list', async () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });

    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    expect(result.current.active.context).toEqual(organizationContext(7));
    expect(result.current.active.activeOrganization?.id).toBe(7);
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });

  it('does not clear the stored context while the list is loading', () => {
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
    mockGetOrganizations.mockReturnValue(new Promise(() => {}));

    const { result } = renderContext();

    expect(result.current.active.status).toBe('loading');
    expect(result.current.active.context).toEqual(organizationContext(7));
    expect(result.current.active.activeOrganization).toBeNull();
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });
});

describe('ActiveContextProvider multi-tab sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });
    seedSession(authUser(5));
  });

  function storageChange(key: string | null, newValue: string | null) {
    act(() => {
      if (key === null) localStorage.clear();
      else if (newValue === null) localStorage.removeItem(key);
      else localStorage.setItem(key, newValue);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
    });
  }

  it('follows another tab that switches the organization', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:5', '8');

    expect(result.current.active.context).toEqual(organizationContext(8));
    expect(result.current.active.activeOrganization?.id).toBe(8);
  });

  it('follows another tab that goes back to personal', async () => {
    localStorage.setItem('active_context:5', '7');
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:5', null);

    expect(result.current.active.context).toEqual(PERSONAL);
  });

  it('ignores storage changes on unrelated keys and on other users', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:6', '8');
    storageChange('something_else', '8');

    expect(result.current.active.context).toEqual(PERSONAL);
  });

  it('re-reads the key when the whole storage is cleared', async () => {
    localStorage.setItem('active_context:5', '7');
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange(null, null);

    expect(result.current.active.context).toEqual(PERSONAL);
  });

  it('reads an invalid value coming from another tab as personal', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:5', 'abc');

    expect(result.current.active.context).toEqual(PERSONAL);
  });

  it('falls back to personal and clears the key when another tab writes an organization that is not in the list', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:5', '99');

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(result.current.active.activeOrganization).toBeNull();
    expect(localStorage.getItem('active_context:5')).toBeNull();
  });

  it('adopts and keeps an organization from another tab that is in the list', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    storageChange('active_context:5', '8');

    expect(result.current.active.context).toEqual(organizationContext(8));
    expect(localStorage.getItem('active_context:5')).toBe('8');
  });

  it('adopts an organization from another tab while the list is loading, then validates it on arrival: unknown id ends personal', async () => {
    let resolveList: (value: { data: unknown[] }) => void = () => {};
    mockGetOrganizations.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const { result } = renderContext();
    expect(result.current.active.status).toBe('loading');

    storageChange('active_context:5', '99');

    expect(result.current.active.context).toEqual(organizationContext(99));
    expect(localStorage.getItem('active_context:5')).toBe('99');

    await act(async () => resolveList({ data: [organization(7), organization(8)] }));

    expect(result.current.active.status).toBe('ready');
    expect(result.current.active.context).toEqual(PERSONAL);
    expect(localStorage.getItem('active_context:5')).toBeNull();
  });

  it('adopts an organization from another tab while the list is loading, then validates it on arrival: known id stays', async () => {
    let resolveList: (value: { data: unknown[] }) => void = () => {};
    mockGetOrganizations.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const { result } = renderContext();

    storageChange('active_context:5', '8');

    expect(result.current.active.context).toEqual(organizationContext(8));

    await act(async () => resolveList({ data: [organization(7), organization(8)] }));

    expect(result.current.active.context).toEqual(organizationContext(8));
    expect(result.current.active.activeOrganization?.id).toBe(8);
    expect(localStorage.getItem('active_context:5')).toBe('8');
  });

  it('keeps the stored context when another tab writes an unknown organization and the list failed to load', async () => {
    mockGetOrganizations.mockRejectedValue(new Error('boom'));
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('error'));

    storageChange('active_context:5', '99');

    expect(result.current.active.context).toEqual(organizationContext(99));
    expect(localStorage.getItem('active_context:5')).toBe('99');
  });

  it('does not demote an activated organization that a storage event echoes back', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    act(() => result.current.active.activateOrganization(organization(9) as Organization));

    storageChange('active_context:5', '9');

    expect(result.current.active.context).toEqual(organizationContext(9));
    expect(result.current.active.activeOrganization?.id).toBe(9);
    expect(localStorage.getItem('active_context:5')).toBe('9');
  });

  it('does not demote an organization activated while the list was loading when a storage event follows the load', async () => {
    let resolveList: (value: { data: unknown[] }) => void = () => {};
    mockGetOrganizations.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const { result } = renderContext();
    act(() => result.current.active.activateOrganization(organization(9) as Organization));
    await act(async () => resolveList({ data: [organization(7)] }));
    expect(result.current.active.status).toBe('ready');

    storageChange('active_context:5', '9');

    expect(result.current.active.context).toEqual(organizationContext(9));
    expect(localStorage.getItem('active_context:5')).toBe('9');
  });

  it('stops listening after unmount', async () => {
    const { result, unmount } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    const spy = vi.spyOn(window, 'removeEventListener');

    unmount();

    expect(spy).toHaveBeenCalledWith('storage', expect.any(Function));
    spy.mockRestore();
  });
});

describe('ActiveContextProvider forced personal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizations.mockResolvedValue({ data: [organization(7), organization(8)] });
    seedSession(authUser(5));
    localStorage.setItem('active_context:5', '7');
  });

  it('demotes to personal when the interceptor forces it', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => forcePersonalContext());

    expect(result.current.active.context).toEqual(PERSONAL);
    expect(result.current.active.activeOrganization).toBeNull();
    expect(localStorage.getItem('active_context:5')).toBeNull();
  });

  it('unsubscribes from forced personal on unmount', async () => {
    const { result, unmount } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));
    unmount();

    expect(() => forcePersonalContext()).not.toThrow();
  });
});

describe('ActiveContextProvider activateOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrganizations.mockResolvedValue({ data: [organization(7)] });
    seedSession(authUser(5));
  });

  it('selects the organization and adds it to the cached list', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => result.current.active.activateOrganization(organization(9) as Organization));

    expect(localStorage.getItem('active_context:5')).toBe('9');
    expect(result.current.active.context).toEqual(organizationContext(9));
    expect(result.current.active.activeOrganization?.name).toBe('Organización 9');
    expect(result.current.active.organizations.map((item) => item.id)).toEqual([7, 9]);
  });

  it('does not duplicate an organization already in the list', async () => {
    const { result } = renderContext();
    await waitFor(() => expect(result.current.active.status).toBe('ready'));

    act(() => result.current.active.activateOrganization(organization(7) as Organization));

    expect(result.current.active.organizations.map((item) => item.id)).toEqual([7]);
  });

  it('keeps the activated organization even if the in-flight list does not contain it yet', async () => {
    let resolveList: (value: { data: unknown[] }) => void = () => {};
    mockGetOrganizations.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const { result } = renderContext();

    act(() => result.current.active.activateOrganization(organization(9) as Organization));
    await act(async () => resolveList({ data: [organization(7)] }));

    expect(result.current.active.status).toBe('ready');
    expect(result.current.active.activeOrganization?.id).toBe(9);
  });
});
