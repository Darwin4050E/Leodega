import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import { getSpendingLimits, setSpendingLimit } from './organizations';

describe('organizations service: spending limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSpendingLimits calls the path-addressed list endpoint', () => {
    getSpendingLimits(7);

    expect(mockApi.get).toHaveBeenCalledWith('/organizations/7/spending-limits');
  });

  it('setSpendingLimit puts the limit string for the target member in the path', () => {
    setSpendingLimit(7, 21, '750.00');

    expect(mockApi.put).toHaveBeenCalledWith('/organizations/7/spending-limits/21', { monthly_limit: '750.00' });
  });

  it('setSpendingLimit sends null to clear the limit', () => {
    setSpendingLimit(7, 21, null);

    expect(mockApi.put).toHaveBeenCalledWith('/organizations/7/spending-limits/21', { monthly_limit: null });
  });
});
