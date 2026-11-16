import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  getPanelHistory,
  getPanelMembers,
  getPanelReservations,
  getPanelSummary,
  isPanelHistoryKind,
  PANEL_HISTORY_KIND,
  PANEL_RESERVATION_STATUS,
  type PaginatedPanelHistory,
  type PaginatedPanelReservations,
  type PanelHistoryEntry,
  type PanelMember,
  type PanelReservation,
  type PanelSummary,
} from './organizations';

describe('organizations service: control panel fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WS8: getPanelSummary reads the path-addressed summary with no params', () => {
    getPanelSummary(5);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/organizations/5/panel/summary');
  });

  it('WS8: getPanelMembers reads the members list with no params', () => {
    getPanelMembers(5);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/organizations/5/panel/members');
  });

  it('WS8: getPanelReservations requests the page as a query parameter', () => {
    getPanelReservations(5, 2);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/organizations/5/panel/reservations', { params: { page: 2 } });
  });

  it('WS8: getPanelHistory requests the page as a query parameter', () => {
    getPanelHistory(5, 3);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/organizations/5/panel/history', { params: { page: 3 } });
  });

  it('WS65: addresses whichever organization it is given, never a fixed one', () => {
    getPanelSummary(8);
    getPanelMembers(8);
    getPanelReservations(8, 1);
    getPanelHistory(8, 1);

    for (const call of mockApi.get.mock.calls) expect(call[0]).toMatch(/^\/organizations\/8\/panel\//);
  });

  it('WS65: only GET is used, with no request body', () => {
    getPanelSummary(5);
    getPanelMembers(5);
    getPanelReservations(5, 1);
    getPanelHistory(5, 1);

    expect(mockApi.get).toHaveBeenCalledTimes(4);
    for (const method of [mockApi.post, mockApi.put, mockApi.patch, mockApi.delete]) {
      expect(method).not.toHaveBeenCalled();
    }
  });

  it('never relies on X-Organization-Id: the organization travels in the path', () => {
    getPanelSummary(5);
    getPanelMembers(5);
    getPanelReservations(5, 1);
    getPanelHistory(5, 1);

    expect(JSON.stringify(mockApi.get.mock.calls)).not.toMatch(/X-Organization-Id/i);
  });

  it('resolves to the typed response of each endpoint', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { organization_id: 5 } });

    const response = await getPanelSummary(5);

    expect(response.data).toEqual({ organization_id: 5 });
    expectTypeOf(response.data).toEqualTypeOf<PanelSummary>();
    expectTypeOf(getPanelMembers(5)).resolves.toMatchTypeOf<{ data: PanelMember[] }>();
    expectTypeOf(getPanelReservations(5, 1)).resolves.toMatchTypeOf<{ data: PaginatedPanelReservations }>();
    expectTypeOf(getPanelHistory(5, 1)).resolves.toMatchTypeOf<{ data: PaginatedPanelHistory }>();
  });
});

describe('organizations service: control panel wire values', () => {
  it('PANEL_HISTORY_KIND exposes the five wire kinds', () => {
    expect(PANEL_HISTORY_KIND).toEqual({
      RESERVATION_CREATED: 'reservation_created',
      RESERVATION_CANCELLED: 'reservation_cancelled',
      WALLET_TOPUP: 'wallet_topup',
      WALLET_REFUND: 'wallet_refund',
      MEMBER_JOINED: 'member_joined',
    });
  });

  it('PANEL_RESERVATION_STATUS exposes the two active statuses', () => {
    expect(PANEL_RESERVATION_STATUS).toEqual({ CONFIRMED: 'confirmed', PENDING: 'pending' });
  });

  it('WS50: isPanelHistoryKind accepts the five kinds and rejects anything else', () => {
    for (const kind of Object.values(PANEL_HISTORY_KIND)) expect(isPanelHistoryKind(kind)).toBe(true);

    expect(isPanelHistoryKind('wallet_withdrawal')).toBe(false);
    expect(isPanelHistoryKind('')).toBe(false);
    expect(isPanelHistoryKind('WALLET_TOPUP')).toBe(false);
  });

  it('WS50: the guard narrows a wire string to the const-object union', () => {
    const entry: PanelHistoryEntry = {
      id: 'wallet_topup:1',
      kind: 'wallet_topup',
      occurred_at: '2026-06-08T09:12:00.000000Z',
      actor_name: null,
      target_label: null,
      amount: '150.00',
    };

    expectTypeOf(entry.kind).toEqualTypeOf<string>();
    if (isPanelHistoryKind(entry.kind)) {
      expectTypeOf(entry.kind).toEqualTypeOf<(typeof PANEL_HISTORY_KIND)[keyof typeof PANEL_HISTORY_KIND]>();
    }
  });
});

describe('organizations service: control panel DTO shapes', () => {
  it('PAN-14: hidden member keys are optional, never nullable stand-ins', () => {
    expectTypeOf<PanelMember['email']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<PanelMember['spent']>().toEqualTypeOf<string | undefined>();
    // Present with `null` means "no limit"; absent means "not visible to you".
    expectTypeOf<PanelMember['monthly_limit']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<PanelMember['joined_at']>().toEqualTypeOf<string | null>();
    expectTypeOf<PanelMember['is_self']>().toEqualTypeOf<boolean>();
  });

  it('PAN-5: the pending invitations count is absent for members', () => {
    expectTypeOf<PanelSummary['pending_invitations_count']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<PanelSummary['role']>().toEqualTypeOf<'admin' | 'member'>();
  });

  it('PAN-7: reservation rows tolerate a missing warehouse or creator', () => {
    expectTypeOf<PanelReservation['warehouse_name']>().toEqualTypeOf<string | null>();
    expectTypeOf<PanelReservation['member_name']>().toEqualTypeOf<string | null>();
    expectTypeOf<PanelReservation['status']>().toEqualTypeOf<'confirmed' | 'pending'>();
  });

  it('PAN-8: history actor, target and amount may each be null', () => {
    expectTypeOf<PanelHistoryEntry['actor_name']>().toEqualTypeOf<string | null>();
    expectTypeOf<PanelHistoryEntry['target_label']>().toEqualTypeOf<string | null>();
    expectTypeOf<PanelHistoryEntry['amount']>().toEqualTypeOf<string | null>();
  });

  it('both paginators are the flat Laravel shape', () => {
    expectTypeOf<keyof PaginatedPanelReservations>().toEqualTypeOf<
      'data' | 'current_page' | 'last_page' | 'per_page' | 'total'
    >();
    expectTypeOf<keyof PaginatedPanelHistory>().toEqualTypeOf<
      'data' | 'current_page' | 'last_page' | 'per_page' | 'total'
    >();
    expectTypeOf<PaginatedPanelReservations['data']>().toEqualTypeOf<PanelReservation[]>();
    expectTypeOf<PaginatedPanelHistory['data']>().toEqualTypeOf<PanelHistoryEntry[]>();
  });
});
