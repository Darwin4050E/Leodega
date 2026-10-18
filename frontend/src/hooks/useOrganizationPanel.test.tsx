import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getPanelSummary: vi.fn(),
  getPanelMembers: vi.fn(),
  getPanelReservations: vi.fn(),
  getPanelHistory: vi.fn(),
}));

vi.mock('../services/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/organizations')>()),
  ...mocks,
}));

import {
  PANEL_STATUS,
  usePanelHistory,
  usePanelMembers,
  usePanelReservations,
  usePanelSummary,
} from './useOrganizationPanel';

function summary(organizationId: number, overrides = {}) {
  return {
    data: {
      organization_id: organizationId,
      role: 'admin',
      members_count: 3,
      active_reservations_count: 2,
      pending_invitations_count: 1,
      ...overrides,
    },
  };
}

function members(...ids: number[]) {
  return {
    data: ids.map((id) => ({ user_id: id, name: `Member ${id}`, role: 'member', joined_at: null, is_self: false })),
  };
}

function paginated(ids: number[], currentPage = 1, lastPage = 3) {
  return {
    data: {
      data: ids.map((id) => ({ id })),
      current_page: currentPage,
      last_page: lastPage,
      per_page: 20,
      total: 45,
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

const NEVER = () => new Promise(() => {});

describe('useOrganizationPanel hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPanelSummary.mockResolvedValue(summary(5));
    mocks.getPanelMembers.mockResolvedValue(members(1, 2));
    mocks.getPanelReservations.mockResolvedValue(paginated([1, 2]));
    mocks.getPanelHistory.mockResolvedValue(paginated([10, 11]));
  });

  it('PANEL_STATUS exposes the five states', () => {
    expect(PANEL_STATUS).toEqual({
      IDLE: 'idle',
      LOADING: 'loading',
      READY: 'ready',
      ERROR: 'error',
      FORBIDDEN: 'forbidden',
    });
  });

  describe('loading', () => {
    it('usePanelSummary loads the organization and exposes data, status, message and reload', async () => {
      const { result } = renderHook(() => usePanelSummary(5));

      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      expect(result.current.data).toBeNull();
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      expect(mocks.getPanelSummary).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelSummary).toHaveBeenCalledWith(5);
      expect(result.current.data).toMatchObject({ organization_id: 5, members_count: 3 });
      expect(result.current.message).toBeNull();
      expect(typeof result.current.reload).toBe('function');
    });

    it('usePanelMembers loads the bare array of the organization', async () => {
      const { result } = renderHook(() => usePanelMembers(5));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      expect(mocks.getPanelMembers).toHaveBeenCalledWith(5);
      expect(result.current.data?.map((member) => member.user_id)).toEqual([1, 2]);
    });

    it('usePanelReservations loads page 1 and exposes the paginator', async () => {
      const { result } = renderHook(() => usePanelReservations(5));

      expect(result.current.page).toBe(1);
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      expect(mocks.getPanelReservations).toHaveBeenCalledWith(5, 1);
      expect(result.current.data).toMatchObject({ last_page: 3, total: 45 });
      expect(result.current.data?.data.map((row) => row.id)).toEqual([1, 2]);
    });

    it('usePanelHistory loads the requested page when enabled', async () => {
      const { result } = renderHook(() => usePanelHistory(5, true, 1));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      expect(mocks.getPanelHistory).toHaveBeenCalledWith(5, 1);
      expect(result.current.data?.data.map((row) => row.id)).toEqual([10, 11]);
    });
  });

  describe('no request', () => {
    it('personal mode (null organization) is idle and issues no request', () => {
      const summaryHook = renderHook(() => usePanelSummary(null));
      const membersHook = renderHook(() => usePanelMembers(null));
      const reservationsHook = renderHook(() => usePanelReservations(null));
      const historyHook = renderHook(() => usePanelHistory(null, true, 1));

      for (const hook of [summaryHook, membersHook, reservationsHook, historyHook]) {
        expect(hook.result.current.status).toBe(PANEL_STATUS.IDLE);
        expect(hook.result.current.data).toBeNull();
      }
      expect(mocks.getPanelSummary).not.toHaveBeenCalled();
      expect(mocks.getPanelMembers).not.toHaveBeenCalled();
      expect(mocks.getPanelReservations).not.toHaveBeenCalled();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });

    it('WS54: history disabled (a member) is idle and issues no request', () => {
      const { result } = renderHook(() => usePanelHistory(5, false, 1));

      expect(result.current.status).toBe(PANEL_STATUS.IDLE);
      expect(result.current.data).toBeNull();
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();
    });

    it('WS9: history loads once the caller turns out to be an admin, and stops when it is not', async () => {
      const { result, rerender } = renderHook(({ enabled }) => usePanelHistory(5, enabled, 1), {
        initialProps: { enabled: false },
      });
      expect(mocks.getPanelHistory).not.toHaveBeenCalled();

      rerender({ enabled: true });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);

      rerender({ enabled: false });
      expect(result.current.status).toBe(PANEL_STATUS.IDLE);
      expect(result.current.data).toBeNull();
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('organization switch', () => {
    it('WS10: switching organization returns to loading and clears the previous data', async () => {
      const { result, rerender } = renderHook(({ id }) => usePanelSummary(id), { initialProps: { id: 7 } });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      mocks.getPanelSummary.mockReturnValueOnce(NEVER());

      rerender({ id: 8 });

      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      expect(result.current.data).toBeNull();
      expect(mocks.getPanelSummary).toHaveBeenLastCalledWith(8);
    });

    it('WS10: switching organization on the reservations list returns to page 1', async () => {
      const { result, rerender } = renderHook(({ id }) => usePanelReservations(id), { initialProps: { id: 7 } });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      act(() => result.current.goToPage(2));
      await waitFor(() => expect(result.current.page).toBe(2));
      mocks.getPanelReservations.mockReturnValueOnce(NEVER());

      rerender({ id: 8 });

      expect(result.current.page).toBe(1);
      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      expect(result.current.data).toBeNull();
      expect(mocks.getPanelReservations).toHaveBeenLastCalledWith(8, 1);
    });

    it('WS10: a forbidden or failed outcome of the previous organization does not carry over', async () => {
      mocks.getPanelSummary.mockRejectedValueOnce(apiError(403, { message: 'No perteneces' }));
      const { result, rerender } = renderHook(({ id }) => usePanelSummary(id), { initialProps: { id: 7 } });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.FORBIDDEN));
      mocks.getPanelSummary.mockReturnValueOnce(NEVER());

      rerender({ id: 8 });

      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      expect(result.current.message).toBeNull();
    });

    it('WS11: discards a late response of the previous organization', async () => {
      const slowSeven = deferred<ReturnType<typeof summary>>();
      mocks.getPanelSummary.mockReturnValueOnce(slowSeven.promise).mockResolvedValueOnce(summary(8));
      const { result, rerender } = renderHook(({ id }) => usePanelSummary(id), { initialProps: { id: 7 } });

      rerender({ id: 8 });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      await act(async () => slowSeven.resolve(summary(7, { members_count: 99 })));

      expect(result.current.data?.organization_id).toBe(8);
      expect(result.current.data?.members_count).toBe(3);
    });

    it('WS11: a late error of the previous organization does not replace the current data', async () => {
      const slowSeven = deferred<ReturnType<typeof summary>>();
      mocks.getPanelMembers.mockReturnValueOnce(slowSeven.promise).mockResolvedValueOnce(members(9));
      const { result, rerender } = renderHook(({ id }) => usePanelMembers(id), { initialProps: { id: 7 } });

      rerender({ id: 8 });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      await act(async () => slowSeven.reject(apiError(500)));

      expect(result.current.status).toBe(PANEL_STATUS.READY);
      expect(result.current.data?.map((member) => member.user_id)).toEqual([9]);
    });
  });

  describe('paging', () => {
    it('WS12: discards a late page-1 reservations response after moving to page 2', async () => {
      const slowPageOne = deferred<ReturnType<typeof paginated>>();
      mocks.getPanelReservations.mockReturnValueOnce(slowPageOne.promise).mockResolvedValueOnce(paginated([7], 2));
      const { result } = renderHook(() => usePanelReservations(5));

      act(() => result.current.goToPage(2));
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      await act(async () => slowPageOne.resolve(paginated([1, 2], 1)));

      expect(result.current.page).toBe(2);
      expect(result.current.data?.data.map((row) => row.id)).toEqual([7]);
      expect(result.current.data?.current_page).toBe(2);
    });

    it('goToPage requests only that page of the same organization and shows loading meanwhile', async () => {
      const { result } = renderHook(() => usePanelReservations(5));
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      mocks.getPanelReservations.mockReturnValueOnce(NEVER());

      act(() => result.current.goToPage(2));

      expect(result.current.page).toBe(2);
      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      expect(result.current.data).toBeNull();
      expect(mocks.getPanelReservations).toHaveBeenLastCalledWith(5, 2);
      expect(mocks.getPanelSummary).not.toHaveBeenCalled();
    });

    it('WS12: history follows the page it is given and drops the late response of the old page', async () => {
      const slowPageOne = deferred<ReturnType<typeof paginated>>();
      mocks.getPanelHistory.mockReturnValueOnce(slowPageOne.promise).mockResolvedValueOnce(paginated([30], 2));
      const { result, rerender } = renderHook(({ page }) => usePanelHistory(5, true, page), {
        initialProps: { page: 1 },
      });

      rerender({ page: 2 });
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      await act(async () => slowPageOne.resolve(paginated([10], 1)));

      expect(mocks.getPanelHistory).toHaveBeenLastCalledWith(5, 2);
      expect(result.current.data?.data.map((row) => row.id)).toEqual([30]);
    });
  });

  describe('failures', () => {
    it('WS13: a 403 on the summary is forbidden and carries the server message verbatim', async () => {
      mocks.getPanelSummary.mockRejectedValue(
        apiError(403, { message: 'No perteneces a la organización seleccionada' }),
      );
      const { result } = renderHook(() => usePanelSummary(5));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.FORBIDDEN));
      expect(result.current.message).toBe('No perteneces a la organización seleccionada');
      expect(result.current.data).toBeNull();
    });

    it('WS52: a 403 on the history is forbidden, not a generic error', async () => {
      mocks.getPanelHistory.mockRejectedValue(apiError(403, { message: 'No autorizado' }));
      const { result } = renderHook(() => usePanelHistory(5, true, 1));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.FORBIDDEN));
      expect(result.current.message).toBe('No autorizado');
    });

    it('a 403 without a body still resolves to forbidden with no message', async () => {
      mocks.getPanelMembers.mockRejectedValue(apiError(403));
      const { result } = renderHook(() => usePanelMembers(5));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.FORBIDDEN));
      expect(result.current.message).toBeNull();
    });

    it('WS60: a 5xx is a plain error that never exposes the server or framework text', async () => {
      mocks.getPanelReservations.mockRejectedValue(apiError(500, { message: 'SQLSTATE[HY000]: stack trace' }));
      const { result } = renderHook(() => usePanelReservations(5));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.ERROR));
      expect(result.current.message).toBeNull();
      expect(result.current.data).toBeNull();
    });

    it('a network failure with no response is a plain error', async () => {
      mocks.getPanelSummary.mockRejectedValue(new Error('Network Error'));
      const { result } = renderHook(() => usePanelSummary(5));

      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.ERROR));
      expect(result.current.message).toBeNull();
    });
  });

  describe('reload', () => {
    it('WS61: reload refetches only its own section', async () => {
      const { result } = renderHook(() => ({
        summary: usePanelSummary(5),
        members: usePanelMembers(5),
        reservations: usePanelReservations(5),
        history: usePanelHistory(5, true, 1),
      }));
      await waitFor(() => {
        for (const section of Object.values(result.current)) expect(section.status).toBe(PANEL_STATUS.READY);
      });

      act(() => result.current.summary.reload());
      await waitFor(() => expect(mocks.getPanelSummary).toHaveBeenCalledTimes(2));

      expect(mocks.getPanelMembers).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelReservations).toHaveBeenCalledTimes(1);
      expect(mocks.getPanelHistory).toHaveBeenCalledTimes(1);
    });

    it('WS61: retrying after an error goes through loading and recovers on success', async () => {
      mocks.getPanelMembers.mockRejectedValueOnce(apiError(500));
      const { result } = renderHook(() => usePanelMembers(5));
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.ERROR));
      const retry = deferred<ReturnType<typeof members>>();
      mocks.getPanelMembers.mockReturnValueOnce(retry.promise);

      act(() => result.current.reload());

      expect(result.current.status).toBe(PANEL_STATUS.LOADING);
      await act(async () => retry.resolve(members(4)));
      expect(result.current.status).toBe(PANEL_STATUS.READY);
      expect(result.current.data?.map((member) => member.user_id)).toEqual([4]);
    });

    it('reload of the reservations list keeps the current page', async () => {
      const { result } = renderHook(() => usePanelReservations(5));
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));
      act(() => result.current.goToPage(2));
      await waitFor(() => expect(result.current.status).toBe(PANEL_STATUS.READY));

      act(() => result.current.reload());

      await waitFor(() => expect(mocks.getPanelReservations).toHaveBeenCalledTimes(3));
      expect(mocks.getPanelReservations).toHaveBeenLastCalledWith(5, 2);
      expect(result.current.page).toBe(2);
    });
  });
});
