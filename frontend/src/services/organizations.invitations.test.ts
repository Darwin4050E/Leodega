import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import { getInvitations, inviteMember, revokeInvitation } from './organizations';

describe('organizations service: invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WS50: inviteMember posts the email to the path-addressed collection', () => {
    inviteMember(5, 'a@b.com');

    expect(mockApi.post).toHaveBeenCalledWith('/organizations/5/invitations', { email: 'a@b.com' });
  });

  it('WS51: getInvitations requests the page as a query parameter', () => {
    getInvitations(5, 2);

    expect(mockApi.get).toHaveBeenCalledWith('/organizations/5/invitations', { params: { page: 2 } });
  });

  it('WS52: revokeInvitation deletes the invitation under its organization', () => {
    revokeInvitation(5, 9);

    expect(mockApi.delete).toHaveBeenCalledWith('/organizations/5/invitations/9');
  });

  it('never passes an X-Organization-Id header: the organization travels in the path', () => {
    inviteMember(5, 'a@b.com');
    getInvitations(5, 1);
    revokeInvitation(5, 9);

    const configs = [...mockApi.post.mock.calls, ...mockApi.get.mock.calls, ...mockApi.delete.mock.calls]
      .map((call) => call[2] ?? call[1]);
    expect(JSON.stringify(configs)).not.toMatch(/X-Organization-Id/i);
  });
});
