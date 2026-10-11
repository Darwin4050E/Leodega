import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mockGetSpendingLimits = vi.hoisted(() => vi.fn());

vi.mock('../services/organizations', () => ({
  getSpendingLimits: mockGetSpendingLimits,
}));

import { SPENDING_LIMITS_STATUS, useSpendingLimits } from './useSpendingLimits';
import { notifyWalletChanged } from '../utils/walletEvents';

function row(overrides = {}) {
  return { user_id: 1, name: 'Ana Pérez', role: 'admin', monthly_limit: '500.00', spent: '120.00', ...overrides };
}

describe('useSpendingLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSpendingLimits.mockResolvedValue({ data: [row()] });
  });

  it('starts loading, then exposes the rows of the organization', async () => {
    const { result } = renderHook(() => useSpendingLimits(7));

    expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.LOADING);
    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.READY));
    expect(result.current.rows).toEqual([row()]);
    expect(mockGetSpendingLimits).toHaveBeenCalledWith(7);
  });

  it('ML-WS3: personal mode (null) issues no request and stays idle', () => {
    const { result } = renderHook(() => useSpendingLimits(null));

    expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.IDLE);
    expect(result.current.rows).toEqual([]);
    expect(mockGetSpendingLimits).not.toHaveBeenCalled();
  });

  it('reports an error status when the request fails', async () => {
    mockGetSpendingLimits.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useSpendingLimits(7));

    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.ERROR));
    expect(result.current.rows).toEqual([]);
  });

  it('ML-WS18: discards a late response of the previous organization', async () => {
    let resolveFirst: (value: { data: unknown[] }) => void = () => {};
    mockGetSpendingLimits
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [row({ user_id: 9, name: 'Luis Mora' })] });
    const { result, rerender } = renderHook(({ id }) => useSpendingLimits(id), { initialProps: { id: 7 } });

    rerender({ id: 8 });
    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.READY));
    await act(async () => resolveFirst({ data: [row({ name: 'Stale' })] }));

    expect(result.current.rows.map((r) => r.name)).toEqual(['Luis Mora']);
  });

  it('does not expose the rows of another organization while the next one loads', async () => {
    mockGetSpendingLimits
      .mockResolvedValueOnce({ data: [row()] })
      .mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useSpendingLimits(id), { initialProps: { id: 7 } });
    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.READY));

    rerender({ id: 8 });

    expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.LOADING);
    expect(result.current.rows).toEqual([]);
  });

  it('ML-WS19: refetches when a wallet change is announced, keeping the rows while it does', async () => {
    const { result } = renderHook(() => useSpendingLimits(7));
    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.READY));
    mockGetSpendingLimits.mockResolvedValue({ data: [row({ spent: '320.00' })] });

    act(() => notifyWalletChanged());

    expect(result.current.rows[0].spent).toBe('120.00');
    await waitFor(() => expect(result.current.rows[0].spent).toBe('320.00'));
    expect(mockGetSpendingLimits).toHaveBeenCalledTimes(2);
  });

  it('refresh() refetches on demand', async () => {
    const { result } = renderHook(() => useSpendingLimits(7));
    await waitFor(() => expect(result.current.status).toBe(SPENDING_LIMITS_STATUS.READY));
    mockGetSpendingLimits.mockResolvedValue({ data: [row({ monthly_limit: '750.00' })] });

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.rows[0].monthly_limit).toBe('750.00'));
    expect(mockGetSpendingLimits).toHaveBeenCalledTimes(2);
  });
});
