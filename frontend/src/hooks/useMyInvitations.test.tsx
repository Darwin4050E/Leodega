import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getMyInvitations: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
  useActiveContext: vi.fn(),
  useInvitationsInbox: vi.fn(),
}));

vi.mock('../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/organizations')>()),
  getMyInvitations: mocks.getMyInvitations,
  acceptInvitation: mocks.acceptInvitation,
  rejectInvitation: mocks.rejectInvitation,
}));
vi.mock('../context/useActiveContext', () => ({ useActiveContext: mocks.useActiveContext }));
vi.mock('../context/useInvitationsInbox', () => ({ useInvitationsInbox: mocks.useInvitationsInbox }));

import { INBOX_STATUS, useMyInvitations } from './useMyInvitations';

const reloadOrganizations = vi.fn();
const selectOrganization = vi.fn();
const selectPersonal = vi.fn();
const activateOrganization = vi.fn();
const setPendingCount = vi.fn();
const refreshPendingCount = vi.fn();
const markJoinedOrganization = vi.fn();

function item(id: number, overrides = {}) {
  return {
    id,
    organization_id: 100 + id,
    organization_name: `Empresa ${id} S.A.`,
    invited_by_name: 'María López',
    role: 'member',
    status: 'pending',
    expires_at: '2026-06-15T12:00:00Z',
    created_at: '2026-06-08T12:00:00Z',
    responded_at: null,
    can_respond: true,
    ...overrides,
  };
}

function inbox(items: unknown[], pendingCount = items.length) {
  return { data: { data: items, pending_count: pendingCount } };
}

function organization(id: number, overrides = {}) {
  return { id, name: `Empresa ${id - 100} S.A.`, ruc: '1790012345001', email: 'a@acme.com', logo: null, status: 'active', role: 'member', ...overrides };
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

async function renderLoaded() {
  const hook = renderHook(() => useMyInvitations());
  await waitFor(() => expect(hook.result.current.status).toBe(INBOX_STATUS.READY));
  return hook;
}

describe('useMyInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActiveContext.mockReturnValue({
      context: { kind: 'personal' },
      reloadOrganizations,
      selectOrganization,
      selectPersonal,
      activateOrganization,
    });
    mocks.useInvitationsInbox.mockReturnValue({
      pendingCount: 0,
      joinedOrganizationIds: [],
      refreshPendingCount,
      setPendingCount,
      markJoinedOrganization,
    });
    mocks.getMyInvitations.mockResolvedValue(inbox([item(1), item(2)]));
  });

  describe('loading', () => {
    it('WS65: requests GET /invitations once and moves from loading to ready with the items', async () => {
      const pending = deferred<ReturnType<typeof inbox>>();
      mocks.getMyInvitations.mockReturnValue(pending.promise);

      const { result } = renderHook(() => useMyInvitations());

      expect(result.current.status).toBe(INBOX_STATUS.LOADING);
      expect(result.current.items).toEqual([]);

      await act(async () => pending.resolve(inbox([item(1), item(2)])));

      expect(result.current.status).toBe(INBOX_STATUS.READY);
      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
      expect(mocks.getMyInvitations).toHaveBeenCalledTimes(1);
      expect(mocks.getMyInvitations).toHaveBeenCalledWith();
    });

    it('WS66: a failed load reports error and retry requests the inbox again', async () => {
      mocks.getMyInvitations.mockRejectedValueOnce(apiError(500, { message: 'SQLSTATE[HY000] boom' }));

      const { result } = renderHook(() => useMyInvitations());
      await waitFor(() => expect(result.current.status).toBe(INBOX_STATUS.ERROR));
      expect(result.current.items).toEqual([]);

      act(() => result.current.retry());

      await waitFor(() => expect(result.current.status).toBe(INBOX_STATUS.READY));
      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
      expect(mocks.getMyInvitations).toHaveBeenCalledTimes(2);
    });

    it('WS66: retry shows the loading state again while the second request is pending', async () => {
      mocks.getMyInvitations.mockRejectedValueOnce(apiError(500));
      const { result } = renderHook(() => useMyInvitations());
      await waitFor(() => expect(result.current.status).toBe(INBOX_STATUS.ERROR));
      mocks.getMyInvitations.mockReturnValue(new Promise(() => {}));

      act(() => result.current.retry());

      expect(result.current.status).toBe(INBOX_STATUS.LOADING);
    });

    it('WS74: keeps the server order and never re-sorts pending and expired items', async () => {
      mocks.getMyInvitations.mockResolvedValue(
        inbox([
          item(9, { status: 'expired', can_respond: false }),
          item(3),
          item(7, { status: 'expired', can_respond: false }),
          item(1),
        ], 2),
      );

      const { result } = await renderLoaded();

      expect(result.current.items.map((entry) => entry.id)).toEqual([9, 3, 7, 1]);
    });

    it('WS80: a response that arrives after unmount is discarded without touching the shared count', async () => {
      const pending = deferred<ReturnType<typeof inbox>>();
      mocks.getMyInvitations.mockReturnValue(pending.promise);

      const { unmount } = renderHook(() => useMyInvitations());
      unmount();
      await act(async () => pending.resolve(inbox([item(1)], 4)));

      expect(setPendingCount).not.toHaveBeenCalled();
    });

    it('WS83: every load publishes pending_count to the shared inbox count', async () => {
      mocks.getMyInvitations.mockResolvedValueOnce(inbox([item(1), item(2, { status: 'expired', can_respond: false })], 1));

      const { result } = await renderLoaded();
      expect(setPendingCount).toHaveBeenLastCalledWith(1);

      mocks.getMyInvitations.mockResolvedValueOnce(inbox([item(1)], 6));
      act(() => result.current.retry());

      await waitFor(() => expect(setPendingCount).toHaveBeenLastCalledWith(6));
      expect(setPendingCount).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['personal', { kind: 'personal' }],
      ['organization', { kind: 'organization', organizationId: 7 }],
    ])('WS63/WS64: sends the same personal request in %s context and no organization-addressed one', async (_name, context) => {
      mocks.useActiveContext.mockReturnValue({
        context,
        reloadOrganizations,
        selectOrganization,
        selectPersonal,
        activateOrganization,
      });

      const { result } = await renderLoaded();

      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
      expect(mocks.getMyInvitations).toHaveBeenCalledTimes(1);
      expect(mocks.getMyInvitations).toHaveBeenCalledWith();
      expect(mocks.acceptInvitation).not.toHaveBeenCalled();
      expect(mocks.rejectInvitation).not.toHaveBeenCalled();
    });
  });

  describe('respond actions', () => {
    it('WS84: accept sends one request for that invitation and marks only that card as accepting', async () => {
      const pending = deferred<{ data: unknown }>();
      mocks.acceptInvitation.mockReturnValue(pending.promise);
      const { result } = await renderLoaded();

      act(() => {
        void result.current.accept(2);
      });

      expect(mocks.acceptInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.acceptInvitation).toHaveBeenCalledWith(2);
      expect(result.current.busy).toEqual({ 2: 'accept' });

      await act(async () => pending.resolve({ data: organization(102) }));
      expect(result.current.busy).toEqual({});
    });

    it('WS86: reject sends one request for that invitation and marks the card as rejecting', async () => {
      const pending = deferred<{ data: unknown }>();
      mocks.rejectInvitation.mockReturnValue(pending.promise);
      const { result } = await renderLoaded();

      act(() => {
        void result.current.reject(1);
      });

      expect(mocks.rejectInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.rejectInvitation).toHaveBeenCalledWith(1);
      expect(result.current.busy).toEqual({ 1: 'reject' });

      await act(async () => pending.resolve({ data: item(1, { status: 'rejected' }) }));
      expect(result.current.busy).toEqual({});
    });

    it('WS85: a second click on the same card while its request is in flight sends nothing', async () => {
      mocks.acceptInvitation.mockReturnValue(new Promise(() => {}));
      const { result } = await renderLoaded();

      act(() => {
        void result.current.accept(1);
        void result.current.accept(1);
        void result.current.reject(1);
      });

      expect(mocks.acceptInvitation).toHaveBeenCalledTimes(1);
      expect(mocks.rejectInvitation).not.toHaveBeenCalled();
    });

    it.each([
      ['WS87', 409, 'Ya respondiste esta invitación'],
      ['WS88', 404, 'Invitación no encontrada'],
    ])('%s: a %i shows the server text verbatim, reloads the inbox and frees the card', async (_ws, status, message) => {
      mocks.acceptInvitation.mockRejectedValue(apiError(status, { message }));
      const { result } = await renderLoaded();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      await act(async () => {
        await result.current.accept(1);
      });

      expect(result.current.failure).toBe(message);
      expect(result.current.busy).toEqual({});
      await waitFor(() => expect(result.current.items.map((entry) => entry.id)).toEqual([2]));
      expect(mocks.getMyInvitations).toHaveBeenCalledTimes(2);
      expect(result.current.status).toBe(INBOX_STATUS.READY);
    });

    it('a reload after a 409 keeps the rows on screen instead of flashing the loading state', async () => {
      mocks.rejectInvitation.mockRejectedValue(apiError(409, { message: 'Ya respondiste esta invitación' }));
      const { result } = await renderLoaded();
      mocks.getMyInvitations.mockReturnValue(new Promise(() => {}));

      await act(async () => {
        await result.current.reject(1);
      });

      expect(result.current.status).toBe(INBOX_STATUS.READY);
      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
    });

    it.each([
      ['WS89 network error', 'accept', undefined, 'No se pudo aceptar la invitación. Intenta nuevamente.'],
      ['WS89 5xx', 'accept', apiError(500, { message: 'SQLSTATE[HY000] boom' }), 'No se pudo aceptar la invitación. Intenta nuevamente.'],
      ['WS90 reject 5xx', 'reject', apiError(503, { message: 'Server Error' }), 'No se pudo rechazar la invitación. Intenta nuevamente.'],
      ['WS91 403 accept', 'accept', apiError(403, { message: 'No autorizado' }), 'No se pudo aceptar la invitación. Intenta nuevamente.'],
      ['WS91 403 reject', 'reject', apiError(403, { message: 'No autorizado' }), 'No se pudo rechazar la invitación. Intenta nuevamente.'],
      ['WS92 5xx framework text', 'reject', apiError(500, { message: 'Illuminate\\Database\\QueryException' }), 'No se pudo rechazar la invitación. Intenta nuevamente.'],
    ])('%s: shows the generic copy, does not reload and frees the card', async (_name, action, error, expected) => {
      const failing = action === 'accept' ? mocks.acceptInvitation : mocks.rejectInvitation;
      failing.mockRejectedValue(error ?? new Error('Network Error'));
      const { result } = await renderLoaded();

      await act(async () => {
        await (action === 'accept' ? result.current.accept(1) : result.current.reject(1));
      });

      expect(result.current.failure).toBe(expected);
      expect(result.current.busy).toEqual({});
      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
      expect(mocks.getMyInvitations).toHaveBeenCalledTimes(1);
    });

    it('a new attempt clears the previous failure', async () => {
      mocks.rejectInvitation.mockRejectedValueOnce(apiError(500));
      const { result } = await renderLoaded();
      await act(async () => {
        await result.current.reject(1);
      });
      expect(result.current.failure).not.toBeNull();

      mocks.rejectInvitation.mockReturnValue(new Promise(() => {}));
      act(() => {
        void result.current.reject(1);
      });

      expect(result.current.failure).toBeNull();
    });

    it.each([
      ['200', () => mocks.acceptInvitation.mockResolvedValue({ data: organization(101) }), true],
      ['409', () => mocks.acceptInvitation.mockRejectedValue(apiError(409, { message: 'Ya respondiste esta invitación' })), true],
      ['404', () => mocks.acceptInvitation.mockRejectedValue(apiError(404, { message: 'Invitación no encontrada' })), true],
      ['500', () => mocks.acceptInvitation.mockRejectedValue(apiError(500)), false],
    ])('WS94: a %s attempt refreshes the shared pending count only when the server answered', async (_status, arrange, refreshes) => {
      arrange();
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });

      expect(refreshPendingCount).toHaveBeenCalledTimes(refreshes ? 1 : 0);
    });
  });

  describe('accept result', () => {
    it('WS95: keeps a confirmation for the accepted invitation with the organization from the response', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });

      expect(result.current.confirmations).toEqual([{ invitationId: 1, organization: organization(101) }]);
      expect(result.current.items.map((entry) => entry.id)).toEqual([1, 2]);
    });

    it('WS96: reloads the organization list exactly once and never changes the active context', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });

      expect(reloadOrganizations).toHaveBeenCalledTimes(1);
      expect(selectOrganization).not.toHaveBeenCalled();
      expect(activateOrganization).not.toHaveBeenCalled();
      expect(selectPersonal).not.toHaveBeenCalled();
    });

    it('WS105: tags the joined organization for the switcher subtitle', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });

      expect(markJoinedOrganization).toHaveBeenCalledTimes(1);
      expect(markJoinedOrganization).toHaveBeenCalledWith(101);
    });

    it('does not reload the organizations or tag anything when the accept fails', async () => {
      mocks.acceptInvitation.mockRejectedValue(apiError(500));
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });

      expect(result.current.confirmations).toEqual([]);
      expect(reloadOrganizations).not.toHaveBeenCalled();
      expect(markJoinedOrganization).not.toHaveBeenCalled();
    });

    it('WS104: two accepts in a row keep two independent confirmations', async () => {
      mocks.acceptInvitation
        .mockResolvedValueOnce({ data: organization(101) })
        .mockResolvedValueOnce({ data: organization(102) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.accept(1);
      });
      await act(async () => {
        await result.current.accept(2);
      });

      expect(result.current.confirmations.map((entry) => entry.invitationId)).toEqual([1, 2]);
      expect(result.current.confirmations.map((entry) => entry.organization.id)).toEqual([101, 102]);
    });

    it('WS110: dismissing a confirmation removes it and its row, and the empty inbox is the plain one', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const { result } = await renderLoaded();
      await act(async () => {
        await result.current.accept(1);
      });

      act(() => result.current.dismissConfirmation(1));

      expect(result.current.confirmations).toEqual([]);
      expect(result.current.items).toEqual([]);
      expect(result.current.rejectedEmpty).toBe(false);
    });

    it('a reload that no longer lists the accepted invitation keeps its confirmation', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const { result } = await renderLoaded();
      await act(async () => {
        await result.current.accept(1);
      });
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      act(() => result.current.retry());
      await waitFor(() => expect(result.current.status).toBe(INBOX_STATUS.READY));

      expect(result.current.items.map((entry) => entry.id)).toEqual([2]);
      expect(result.current.confirmations.map((entry) => entry.invitationId)).toEqual([1]);
    });

    it('WS106: a fresh mount has no confirmation', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      const first = await renderLoaded();
      await act(async () => {
        await first.result.current.accept(1);
      });
      first.unmount();
      mocks.getMyInvitations.mockResolvedValue(inbox([item(2)], 1));

      const { result } = await renderLoaded();

      expect(result.current.confirmations).toEqual([]);
      expect(result.current.items.map((entry) => entry.id)).toEqual([2]);
    });
  });

  describe('reject result', () => {
    it('WS107: removes the rejected row without touching the organizations, the context or the joined tags', async () => {
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.reject(1);
      });

      expect(result.current.items.map((entry) => entry.id)).toEqual([2]);
      expect(reloadOrganizations).not.toHaveBeenCalled();
      expect(markJoinedOrganization).not.toHaveBeenCalled();
      expect(selectOrganization).not.toHaveBeenCalled();
      expect(activateOrganization).not.toHaveBeenCalled();
      expect(selectPersonal).not.toHaveBeenCalled();
    });

    it('WS108: other rows stay and the post-reject flag is off while some remain', async () => {
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.reject(1);
      });

      expect(result.current.rejectedEmpty).toBe(false);
    });

    it('WS109: rejecting the last row turns on the post-reject empty flag', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.reject(1);
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.rejectedEmpty).toBe(true);
    });

    it('a confirmation still on screen keeps the inbox from counting as empty after a reject', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1), item(2)]));
      mocks.acceptInvitation.mockResolvedValue({ data: organization(101) });
      mocks.rejectInvitation.mockResolvedValue({ data: item(2, { status: 'rejected' }) });
      const { result } = await renderLoaded();
      await act(async () => {
        await result.current.accept(1);
      });

      await act(async () => {
        await result.current.reject(2);
      });

      expect(result.current.items.map((entry) => entry.id)).toEqual([1]);
      expect(result.current.rejectedEmpty).toBe(false);
    });

    it('WS111: the flag does not survive a reload', async () => {
      mocks.getMyInvitations.mockResolvedValue(inbox([item(1)]));
      mocks.rejectInvitation.mockResolvedValue({ data: item(1, { status: 'rejected' }) });
      const { result } = await renderLoaded();
      await act(async () => {
        await result.current.reject(1);
      });
      expect(result.current.rejectedEmpty).toBe(true);
      mocks.getMyInvitations.mockResolvedValue(inbox([]));

      act(() => result.current.retry());
      await waitFor(() => expect(result.current.status).toBe(INBOX_STATUS.READY));

      expect(result.current.rejectedEmpty).toBe(false);
    });
  });
});
