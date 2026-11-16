import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  acceptInvitation,
  getInvitations,
  getMyInvitations,
  inviteMember,
  rejectInvitation,
  revokeInvitation,
  type InboxInvitation,
  type InvitationInbox,
  type InvitationStatus,
  type Organization,
} from './organizations';

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

describe('organizations service: invitee inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WS58: getMyInvitations requests the personal collection with no params', () => {
    getMyInvitations();

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/invitations');
  });

  it('WS59: acceptInvitation posts to the accept path without a body', () => {
    acceptInvitation(9);

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/invitations/9/accept');
  });

  it('WS60: rejectInvitation posts to the reject path without a body', () => {
    rejectInvitation(9);

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/invitations/9/reject');
  });

  it('WS59: acceptInvitation resolves to the joined Organization', async () => {
    const joined: Organization = {
      id: 7,
      name: 'Importadora Andina S.A.',
      ruc: '1790012345001',
      email: 'ops@andina.test',
      logo: null,
      status: 'active',
      role: 'member',
    };
    mockApi.post.mockResolvedValueOnce({ data: joined });

    const response = await acceptInvitation(9);

    expect(response.data).toEqual(joined);
    expectTypeOf(response.data).toEqualTypeOf<Organization>();
  });

  it('WS64: none of the three calls sends an organization id or relies on X-Organization-Id', () => {
    getMyInvitations();
    acceptInvitation(9);
    rejectInvitation(9);

    const calls = [...mockApi.get.mock.calls, ...mockApi.post.mock.calls];
    expect(calls).toHaveLength(3);
    expect(JSON.stringify(calls)).not.toMatch(/X-Organization-Id|organization_id|\/organizations\//i);
    // One argument only: no config object (headers/params) rides along.
    for (const call of calls) expect(call).toHaveLength(1);
  });

  it('WS61: the inbox item is a flat interface using the const-object status', () => {
    expectTypeOf<InboxInvitation['status']>().toEqualTypeOf<InvitationStatus>();
    expectTypeOf<InvitationInbox>().toEqualTypeOf<{ data: InboxInvitation[]; pending_count: number }>();
    expectTypeOf<keyof InboxInvitation>().toEqualTypeOf<
      | 'id'
      | 'organization_id'
      | 'organization_name'
      | 'invited_by_name'
      | 'role'
      | 'status'
      | 'expires_at'
      | 'created_at'
      | 'responded_at'
      | 'can_respond'
    >();
    expectTypeOf<InboxInvitation['invited_by_name']>().toEqualTypeOf<string | null>();
    expectTypeOf<InboxInvitation['responded_at']>().toEqualTypeOf<string | null>();
  });
});
