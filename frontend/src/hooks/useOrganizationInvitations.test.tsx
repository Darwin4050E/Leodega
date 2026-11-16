import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getInvitations: vi.fn(),
  inviteMember: vi.fn(),
  revokeInvitation: vi.fn(),
}));

vi.mock('../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/organizations')>()),
  ...mocks,
}));

import { INVITATIONS_STATUS, SUBMIT_STATUS, useOrganizationInvitations } from './useOrganizationInvitations';
import { INVITATION_COPY } from '../utils/invitationCopy';

function invitation(id: number, overrides = {}) {
  return {
    id,
    email: `user${id}@x.com`,
    status: 'pending',
    expires_at: '2026-06-15T12:00:00Z',
    created_at: '2026-06-08T12:00:00Z',
    responded_at: null,
    invited_by_name: 'María López',
    can_be_revoked: true,
    ...overrides,
  };
}

function paginated(ids: number[], overrides = {}) {
  return {
    data: {
      data: ids.map((id) => invitation(id)),
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: ids.length,
      pending_count: ids.length,
      ...overrides,
    },
  };
}

function apiError(status: number, data: unknown = {}) {
  return { response: { status, data } };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderLoaded(organizationId = 5) {
  const hook = renderHook(({ id }) => useOrganizationInvitations(id), { initialProps: { id: organizationId as number | null } });
  await waitFor(() => expect(hook.result.current.status).toBe(INVITATIONS_STATUS.READY));
  return hook;
}

describe('useOrganizationInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInvitations.mockResolvedValue(paginated([1, 2]));
    mocks.inviteMember.mockResolvedValue({ data: invitation(3) });
    mocks.revokeInvitation.mockResolvedValue({ data: invitation(1, { status: 'cancelled', can_be_revoked: false }) });
  });

  it('loads page 1 of the organization and exposes the paginator', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1, 2], { total: 25, pending_count: 2, last_page: 2 }));
    const { result } = renderHook(() => useOrganizationInvitations(5));

    expect(result.current.status).toBe(INVITATIONS_STATUS.LOADING);
    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.READY));
    expect(mocks.getInvitations).toHaveBeenCalledWith(5, 1);
    expect(result.current.items.map((item) => item.id)).toEqual([1, 2]);
    expect(result.current).toMatchObject({ page: 1, lastPage: 2, total: 25, pendingCount: 2 });
  });

  it('WS2 WS3: no organization (personal mode or a non-admin caller) issues no request', () => {
    const { result } = renderHook(() => useOrganizationInvitations(null));

    expect(result.current.status).toBe(INVITATIONS_STATUS.IDLE);
    expect(result.current.items).toEqual([]);
    expect(mocks.getInvitations).not.toHaveBeenCalled();
  });

  it('WS47: discards a late response of the previous organization', async () => {
    const first = deferred<ReturnType<typeof paginated>>();
    mocks.getInvitations.mockReturnValueOnce(first.promise).mockResolvedValueOnce(paginated([9]));
    const { result, rerender } = renderHook(({ id }) => useOrganizationInvitations(id), { initialProps: { id: 5 } });

    rerender({ id: 6 });
    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.READY));
    await act(async () => first.resolve(paginated([1, 2])));

    expect(result.current.items.map((item) => item.id)).toEqual([9]);
  });

  it('WS47: discards a late response of the previous page', async () => {
    const { result } = await renderLoaded();
    const slowPageTwo = deferred<ReturnType<typeof paginated>>();
    mocks.getInvitations.mockReturnValueOnce(slowPageTwo.promise).mockResolvedValueOnce(paginated([7], { current_page: 3, last_page: 3 }));

    act(() => result.current.goToPage(2));
    act(() => result.current.goToPage(3));
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual([7]));
    await act(async () => slowPageTwo.resolve(paginated([4], { current_page: 2, last_page: 3 })));

    expect(result.current.items.map((item) => item.id)).toEqual([7]);
    expect(result.current.page).toBe(3);
  });

  it('WS10 WS48: switching organization clears the list and returns to page 1', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1], { last_page: 3 }));
    const { result, rerender } = await renderLoaded(5);
    mocks.getInvitations.mockResolvedValueOnce(paginated([2], { current_page: 2, last_page: 3 }));
    act(() => result.current.goToPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    mocks.getInvitations.mockReturnValueOnce(new Promise(() => {}));

    rerender({ id: 6 });

    expect(result.current.status).toBe(INVITATIONS_STATUS.LOADING);
    expect(result.current.items).toEqual([]);
    expect(result.current.page).toBe(1);
    expect(mocks.getInvitations).toHaveBeenLastCalledWith(6, 1);
  });

  it('goToPage requests that page of the same organization', async () => {
    const { result } = await renderLoaded();
    mocks.getInvitations.mockResolvedValueOnce(paginated([5], { current_page: 2, last_page: 2 }));

    act(() => result.current.goToPage(2));

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual([5]));
    expect(mocks.getInvitations).toHaveBeenLastCalledWith(5, 2);
    expect(result.current.page).toBe(2);
  });

  it('shows the loading state, not the previous page rows, while another page loads', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1], { total: 25, pending_count: 2, last_page: 2 }));
    const { result } = await renderLoaded();
    mocks.getInvitations.mockReturnValueOnce(new Promise(() => {}));

    act(() => result.current.goToPage(2));

    expect(result.current.status).toBe(INVITATIONS_STATUS.LOADING);
    expect(result.current.items).toEqual([]);
    expect(result.current).toMatchObject({ page: 2, lastPage: 2, total: 25, pendingCount: 2 });
  });

  it('WS49: a failed page change reports a list error and keeps the pagination usable', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1], { last_page: 3 }));
    const { result } = await renderLoaded();
    mocks.getInvitations.mockRejectedValueOnce(apiError(500));

    act(() => result.current.goToPage(2));

    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.ERROR));
    expect(result.current.page).toBe(2);
    expect(result.current.lastPage).toBe(3);

    mocks.getInvitations.mockResolvedValueOnce(paginated([1], { last_page: 3 }));
    act(() => result.current.goToPage(1));
    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.READY));
  });

  it('WS46: a successful invite returns to page 1 even from page 2', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1], { last_page: 2 }));
    const { result } = await renderLoaded();
    mocks.getInvitations.mockResolvedValueOnce(paginated([2], { current_page: 2, last_page: 2 }));
    act(() => result.current.goToPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    mocks.getInvitations.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.invite('ana@x.com');
    });

    expect(ok).toBe(true);
    expect(mocks.inviteMember).toHaveBeenCalledWith(5, 'ana@x.com');
    expect(result.current.submit.status).toBe(SUBMIT_STATUS.SUCCESS);
    await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledWith(5, 1));
    expect(result.current.page).toBe(1);
  });

  it('WS15: a second invite while one is in flight sends no second request', async () => {
    const { result } = await renderLoaded();
    const pending = deferred<{ data: ReturnType<typeof invitation> }>();
    mocks.inviteMember.mockReturnValueOnce(pending.promise);

    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(true);
    act(() => {
      first = result.current.invite('ana@x.com');
      second = result.current.invite('ana@x.com');
    });

    expect(result.current.submit.status).toBe(SUBMIT_STATUS.SUBMITTING);
    await act(async () => pending.resolve({ data: invitation(3) }));
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(mocks.inviteMember).toHaveBeenCalledTimes(1);
  });

  it('WS17 WS22: a 422 refusal exposes the server text and does not reload the list', async () => {
    const { result } = await renderLoaded();
    mocks.getInvitations.mockClear();
    mocks.inviteMember.mockRejectedValueOnce(
      apiError(422, { message: 'Ya hay una invitación pendiente', errors: { email: ['Ya hay una invitación pendiente'] } }),
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.invite('ana@x.com');
    });

    expect(ok).toBe(false);
    expect(result.current.submit).toEqual({ status: SUBMIT_STATUS.ERROR, message: 'Ya hay una invitación pendiente' });
    expect(mocks.getInvitations).not.toHaveBeenCalled();
  });

  it('WS20: a network error on invite exposes the generic send error', async () => {
    const { result } = await renderLoaded();
    mocks.inviteMember.mockRejectedValueOnce(new Error('Network Error'));

    await act(async () => {
      await result.current.invite('ana@x.com');
    });

    expect(result.current.submit).toEqual({ status: SUBMIT_STATUS.ERROR, message: INVITATION_COPY.sendError });
  });

  it('WS21: resetSubmit clears the outcome of the last invite', async () => {
    const { result } = await renderLoaded();
    mocks.inviteMember.mockRejectedValueOnce(apiError(500));
    await act(async () => {
      await result.current.invite('ana@x.com');
    });

    act(() => result.current.resetSubmit());

    expect(result.current.submit).toEqual({ status: SUBMIT_STATUS.IDLE, message: null });
  });

  it('does not carry the invite outcome over to another organization', async () => {
    const { result, rerender } = await renderLoaded(5);
    mocks.inviteMember.mockRejectedValueOnce(apiError(500));
    await act(async () => {
      await result.current.invite('ana@x.com');
    });

    rerender({ id: 6 });

    expect(result.current.submit).toEqual({ status: SUBMIT_STATUS.IDLE, message: null });
  });

  it('WS36: a successful revoke reloads the SAME page', async () => {
    mocks.getInvitations.mockResolvedValue(paginated([1], { last_page: 3 }));
    const { result } = await renderLoaded();
    mocks.getInvitations.mockResolvedValueOnce(paginated([2], { current_page: 2, last_page: 3 }));
    act(() => result.current.goToPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    mocks.getInvitations.mockClear();

    let ok = false;
    await act(async () => {
      ok = await result.current.revoke(2);
    });

    expect(ok).toBe(true);
    expect(mocks.revokeInvitation).toHaveBeenCalledWith(5, 2);
    await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledWith(5, 2));
    expect(result.current.revokingId).toBeNull();
  });

  it('WS35: tracks the row being revoked and ignores a second activation', async () => {
    const { result } = await renderLoaded();
    const pending = deferred<{ data: ReturnType<typeof invitation> }>();
    mocks.revokeInvitation.mockReturnValueOnce(pending.promise);

    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(true);
    act(() => {
      first = result.current.revoke(1);
      second = result.current.revoke(1);
    });

    expect(result.current.revokingId).toBe(1);
    await act(async () => pending.resolve({ data: invitation(1) }));
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(mocks.revokeInvitation).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'Esta invitación ya no está disponible'],
    [404, 'Invitación no encontrada'],
  ])('WS37 WS38: a revoke %i exposes the server message and reloads the list', async (status, message) => {
    const { result } = await renderLoaded();
    mocks.getInvitations.mockClear();
    mocks.revokeInvitation.mockRejectedValueOnce(apiError(status, { message }));

    let ok = true;
    await act(async () => {
      ok = await result.current.revoke(1);
    });

    expect(ok).toBe(false);
    expect(result.current.revokeMessage).toBe(message);
    await waitFor(() => expect(mocks.getInvitations).toHaveBeenCalledWith(5, 1));
  });

  it('WS40: a network error on revoke exposes the generic error and frees the row', async () => {
    const { result } = await renderLoaded();
    mocks.revokeInvitation.mockRejectedValueOnce(new Error('Network Error'));

    await act(async () => {
      await result.current.revoke(1);
    });

    expect(result.current.revokeMessage).toBe(INVITATION_COPY.revokeError);
    expect(result.current.revokingId).toBeNull();
  });

  it('WS5: a 403 on load sets the forbidden state', async () => {
    mocks.getInvitations.mockRejectedValue(apiError(403, { message: 'No autorizado' }));
    const { result } = renderHook(() => useOrganizationInvitations(5));

    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.FORBIDDEN));
    expect(result.current.items).toEqual([]);
    expect(mocks.getInvitations).toHaveBeenCalledTimes(1);
  });

  it('WS6: a 403 on invite sets the forbidden state', async () => {
    const { result } = await renderLoaded();
    mocks.inviteMember.mockRejectedValueOnce(apiError(403, { message: 'No autorizado' }));

    await act(async () => {
      await result.current.invite('ana@x.com');
    });

    expect(result.current.status).toBe(INVITATIONS_STATUS.FORBIDDEN);
    expect(result.current.items).toEqual([]);
  });

  it('WS39: a 403 on revoke sets the forbidden state', async () => {
    const { result } = await renderLoaded();
    mocks.revokeInvitation.mockRejectedValueOnce(apiError(403, { message: 'No autorizado' }));

    await act(async () => {
      await result.current.revoke(1);
    });

    expect(result.current.status).toBe(INVITATIONS_STATUS.FORBIDDEN);
  });

  it('forbidden is per organization: another organization loads normally', async () => {
    mocks.getInvitations.mockRejectedValueOnce(apiError(403, { message: 'No autorizado' }));
    const { result, rerender } = renderHook(({ id }) => useOrganizationInvitations(id), { initialProps: { id: 5 } });
    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.FORBIDDEN));

    rerender({ id: 6 });

    await waitFor(() => expect(result.current.status).toBe(INVITATIONS_STATUS.READY));
    expect(result.current.items.map((item) => item.id)).toEqual([1, 2]);
  });
});
