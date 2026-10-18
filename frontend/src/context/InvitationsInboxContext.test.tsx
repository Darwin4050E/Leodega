import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockGetOrganizations = vi.hoisted(() => vi.fn());
const mockGetMyInvitations = vi.hoisted(() => vi.fn());

vi.mock('../services/organizations', () => ({
  getOrganizations: mockGetOrganizations,
  getMyInvitations: mockGetMyInvitations,
}));

import { AuthProvider } from './AuthContext';
import { ActiveContextProvider } from './ActiveContext';
import { InvitationsInboxProvider } from './InvitationsInboxContext';
import { useActiveContext } from './useActiveContext';
import { useAuth } from './useAuth';
import { useInvitationsInbox } from './useInvitationsInbox';
import type { AuthUser } from './authContextBase';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <ActiveContextProvider>
      <InvitationsInboxProvider>{children}</InvitationsInboxProvider>
    </ActiveContextProvider>
  </AuthProvider>
);

function authUser(id: number, role: AuthUser['role'] = 'tenant'): AuthUser {
  return { id, name: 'Ana', lastname: 'Pérez', email: 'ana@example.com', role };
}

function seedSession(user: AuthUser) {
  localStorage.setItem('auth_token', 'tok');
  localStorage.setItem('auth_user', JSON.stringify(user));
}

function inbox(pendingCount: number) {
  return { data: { data: [], pending_count: pendingCount } };
}

function renderInbox() {
  return renderHook(() => ({ inbox: useInvitationsInbox(), active: useActiveContext(), auth: useAuth() }), {
    wrapper,
  });
}

describe('InvitationsInboxProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetOrganizations.mockResolvedValue({ data: [] });
    mockGetMyInvitations.mockResolvedValue(inbox(3));
  });

  it('WS116: requests the inbox once when a tenant session mounts and exposes pending_count', async () => {
    seedSession(authUser(5));

    const { result } = renderInbox();

    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));
    expect(mockGetMyInvitations).toHaveBeenCalledTimes(1);
  });

  it('starts at zero before the count arrives', () => {
    seedSession(authUser(5));
    mockGetMyInvitations.mockReturnValue(new Promise(() => {}));

    const { result } = renderInbox();

    expect(result.current.inbox.pendingCount).toBe(0);
  });

  it.each(['landlord', 'admin'] as const)('WS120: a %s session never calls GET /invitations', async (role) => {
    seedSession(authUser(5, role));

    const { result } = renderInbox();

    await waitFor(() => expect(result.current.active.enabled).toBe(false));
    expect(mockGetMyInvitations).not.toHaveBeenCalled();
    expect(result.current.inbox.pendingCount).toBe(0);
  });

  it('WS120: an anonymous visitor never calls GET /invitations', () => {
    renderInbox();

    expect(mockGetMyInvitations).not.toHaveBeenCalled();
  });

  it('WS118: a failed count request leaves the count at zero without throwing', async () => {
    seedSession(authUser(5));
    mockGetMyInvitations.mockRejectedValue(new Error('Network Error'));

    const { result } = renderInbox();

    await waitFor(() => expect(mockGetMyInvitations).toHaveBeenCalledTimes(1));
    expect(result.current.inbox.pendingCount).toBe(0);
  });

  it('keeps zero when the payload has no numeric pending_count', async () => {
    seedSession(authUser(5));
    mockGetMyInvitations.mockResolvedValue({ data: { data: [] } });

    const { result } = renderInbox();

    await waitFor(() => expect(mockGetMyInvitations).toHaveBeenCalledTimes(1));
    expect(result.current.inbox.pendingCount).toBe(0);
  });

  it('WS120: an organization list in error does not stop the count', async () => {
    seedSession(authUser(5));
    mockGetOrganizations.mockRejectedValue(new Error('boom'));

    const { result } = renderInbox();

    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));
    expect(result.current.active.status).toBe('error');
  });

  it('WS117: refreshPendingCount requests the inbox again and updates the count', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));
    mockGetMyInvitations.mockResolvedValue(inbox(1));

    act(() => result.current.inbox.refreshPendingCount());

    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(1));
    expect(mockGetMyInvitations).toHaveBeenCalledTimes(2);
  });

  it('WS117: a failed refresh keeps the last known count', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));
    mockGetMyInvitations.mockRejectedValue(new Error('Network Error'));

    act(() => result.current.inbox.refreshPendingCount());

    await waitFor(() => expect(mockGetMyInvitations).toHaveBeenCalledTimes(2));
    expect(result.current.inbox.pendingCount).toBe(3);
  });

  it('WS83: setPendingCount replaces the shared count without a request', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));

    act(() => result.current.inbox.setPendingCount(7));

    expect(result.current.inbox.pendingCount).toBe(7);
    expect(mockGetMyInvitations).toHaveBeenCalledTimes(1);
  });

  it('drops the count when the session ends', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));

    act(() => result.current.auth.logout());

    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(0));
  });

  it('D13 WS105: a just-joined organization is reported until the active context changes', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));

    act(() => result.current.inbox.markJoinedOrganization(7));
    expect(result.current.inbox.joinedOrganizationIds).toEqual([7]);

    act(() => result.current.active.selectOrganization(7));
    expect(result.current.inbox.joinedOrganizationIds).toEqual([]);
  });

  it('D13: joining several organizations accumulates them without duplicates', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));

    act(() => result.current.inbox.markJoinedOrganization(7));
    act(() => result.current.inbox.markJoinedOrganization(8));
    act(() => result.current.inbox.markJoinedOrganization(7));

    expect(result.current.inbox.joinedOrganizationIds).toEqual([7, 8]);
  });

  it('D13: the just-joined list stays while the same context remains selected', async () => {
    seedSession(authUser(5));
    const { result } = renderInbox();
    await waitFor(() => expect(result.current.inbox.pendingCount).toBe(3));

    act(() => result.current.inbox.markJoinedOrganization(7));
    act(() => result.current.active.selectPersonal());

    expect(result.current.inbox.joinedOrganizationIds).toEqual([7]);
  });
});

describe('useInvitationsInbox outside the provider', () => {
  it('returns an inert value so screens mounted without the provider keep working', () => {
    const { result } = renderHook(() => useInvitationsInbox());

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.joinedOrganizationIds).toEqual([]);
    expect(() => {
      result.current.refreshPendingCount();
      result.current.setPendingCount(4);
      result.current.markJoinedOrganization(7);
    }).not.toThrow();
    expect(result.current.pendingCount).toBe(0);
  });
});
