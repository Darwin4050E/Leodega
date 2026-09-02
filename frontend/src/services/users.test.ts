import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import { getUsers, blockUser, reactivateUser, registerUser } from './users';

describe('users service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUsers calls GET /user', () => {
    getUsers();
    expect(mockApi.get).toHaveBeenCalledWith('/user');
  });

  it('registerUser posts to /user with the payload', () => {
    registerUser({ email: 'a@b.com' });
    expect(mockApi.post).toHaveBeenCalledWith('/user', { email: 'a@b.com' });
  });

  it('blockUser patches /user/:id/block with the reason in the body', () => {
    blockUser(7, 'spam');
    expect(mockApi.patch).toHaveBeenCalledWith('/user/7/block', { reason: 'spam' });
  });

  it('reactivateUser patches /user/:id/reactivate with no body', () => {
    reactivateUser(7);
    expect(mockApi.patch).toHaveBeenCalledWith('/user/7/reactivate');
  });
});
