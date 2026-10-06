import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CONTEXT_KIND,
  ORGANIZATION_FORBIDDEN_MESSAGE,
  ORGANIZATION_HEADER,
  activeContextKey,
  clearStoredActiveContext,
  forcePersonalContext,
  parseOrganizationId,
  readRequestOrganizationId,
  readStoredOrganizationId,
  subscribeToForcedPersonal,
  writeStoredOrganizationId,
} from './activeContext';

function seedSession(user: Record<string, unknown> | string, token: string | null = 'tok') {
  if (token !== null) localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', typeof user === 'string' ? user : JSON.stringify(user));
}

describe('constants', () => {
  it('exposes the wire contract shared with the backend middleware', () => {
    expect(ORGANIZATION_HEADER).toBe('X-Organization-Id');
    expect(ORGANIZATION_FORBIDDEN_MESSAGE).toBe('No perteneces a la organización seleccionada');
    expect(CONTEXT_KIND).toEqual({ PERSONAL: 'personal', ORGANIZATION: 'organization' });
  });

  it('builds one storage key per user', () => {
    expect(activeContextKey(5)).toBe('active_context:5');
    expect(activeContextKey(6)).toBe('active_context:6');
  });
});

describe('parseOrganizationId', () => {
  it.each([
    ['7', 7],
    ['12', 12],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('accepts the canonical positive decimal %s', (raw, expected) => {
    expect(parseOrganizationId(raw)).toBe(expected);
  });

  it.each([
    'abc',
    '0',
    '-1',
    '{"x":1}',
    '01',
    '+1',
    '1.5',
    '1e2',
    '0x1',
    '1,2',
    ' 7',
    '',
    '99999999999999999999',
    '9007199254740993',
  ])('treats %j as personal', (raw) => {
    expect(parseOrganizationId(raw)).toBeNull();
  });

  it('treats a missing value as personal', () => {
    expect(parseOrganizationId(null)).toBeNull();
  });
});

describe('stored organization id', () => {
  beforeEach(() => localStorage.clear());

  it('writes the decimal id under the user key and reads it back', () => {
    writeStoredOrganizationId(5, 7);

    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(readStoredOrganizationId(5)).toBe(7);
  });

  it('reads personal when the key is absent', () => {
    expect(readStoredOrganizationId(5)).toBeNull();
  });

  it('keeps users isolated from each other', () => {
    writeStoredOrganizationId(5, 7);

    expect(readStoredOrganizationId(6)).toBeNull();
    writeStoredOrganizationId(6, 9);
    expect(readStoredOrganizationId(5)).toBe(7);
    expect(readStoredOrganizationId(6)).toBe(9);
  });

  it.each(['abc', '0', '-1', '{"x":1}', '01', '99999999999999999999'])(
    'reads %j as personal without touching storage',
    (raw) => {
      localStorage.setItem('active_context:5', raw);

      expect(readStoredOrganizationId(5)).toBeNull();
      expect(localStorage.getItem('active_context:5')).toBe(raw);
    },
  );
});

describe('clearStoredActiveContext', () => {
  beforeEach(() => localStorage.clear());

  it('removes only the key of the user stored in auth_user', () => {
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);
    writeStoredOrganizationId(6, 9);

    clearStoredActiveContext();

    expect(localStorage.getItem('active_context:5')).toBeNull();
    expect(localStorage.getItem('active_context:6')).toBe('9');
  });

  it('does nothing when auth_user is missing or unparsable', () => {
    writeStoredOrganizationId(5, 7);
    clearStoredActiveContext();
    expect(localStorage.getItem('active_context:5')).toBe('7');

    seedSession('{not json');
    clearStoredActiveContext();
    expect(localStorage.getItem('active_context:5')).toBe('7');
  });
});

describe('readRequestOrganizationId', () => {
  beforeEach(() => localStorage.clear());

  it('returns the stored id for a tenant session', () => {
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);

    expect(readRequestOrganizationId()).toBe(7);
  });

  it('returns null without a token even when a key was left behind', () => {
    seedSession({ id: 5, role: 'tenant' }, null);
    writeStoredOrganizationId(5, 7);

    expect(readRequestOrganizationId()).toBeNull();
  });

  it('returns null when auth_user is unparsable or has no numeric id', () => {
    writeStoredOrganizationId(5, 7);

    seedSession('{not json');
    expect(readRequestOrganizationId()).toBeNull();

    seedSession({ role: 'tenant' });
    expect(readRequestOrganizationId()).toBeNull();
  });

  it.each(['landlord', 'admin'])('returns null for a %s even with a stored key', (role) => {
    seedSession({ id: 5, role });
    writeStoredOrganizationId(5, 7);

    expect(readRequestOrganizationId()).toBeNull();
  });

  it('returns null when the key is absent or invalid', () => {
    seedSession({ id: 5, role: 'tenant' });
    expect(readRequestOrganizationId()).toBeNull();

    localStorage.setItem('active_context:5', 'abc');
    expect(readRequestOrganizationId()).toBeNull();
  });

  it('only reads the key of the user in auth_user', () => {
    seedSession({ id: 6, role: 'tenant' });
    writeStoredOrganizationId(5, 7);

    expect(readRequestOrganizationId()).toBeNull();
  });
});

describe('forcePersonalContext', () => {
  beforeEach(() => localStorage.clear());

  it('removes the current user key and notifies every subscriber', () => {
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = subscribeToForcedPersonal(first);
    const offSecond = subscribeToForcedPersonal(second);

    forcePersonalContext();

    expect(localStorage.getItem('active_context:5')).toBeNull();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops notifying a listener after it unsubscribes', () => {
    seedSession({ id: 5, role: 'tenant' });
    const kept = vi.fn();
    const dropped = vi.fn();
    const offKept = subscribeToForcedPersonal(kept);
    const offDropped = subscribeToForcedPersonal(dropped);

    offDropped();
    forcePersonalContext();

    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
    offKept();
  });
});
