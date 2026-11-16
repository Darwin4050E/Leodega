import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import api from './axios';
import {
  ORGANIZATION_FORBIDDEN_MESSAGE,
  subscribeToForcedPersonal,
  writeStoredOrganizationId,
} from '../utils/activeContext';

const originalAdapter = api.defaults.adapter;

let sentConfig: InternalAxiosRequestConfig | undefined;
let rejectedError: AxiosError | undefined;
let beforeReply: (() => void) | undefined;

function respondWith(status: number, data: unknown = {}) {
  const adapter: AxiosAdapter = async (config) => {
    sentConfig = config;
    beforeReply?.();
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      rejectedError = new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
      throw rejectedError;
    }
    return response;
  };
  api.defaults.adapter = adapter;
}

function failWithNetworkError() {
  api.defaults.adapter = async (config) => {
    sentConfig = config;
    rejectedError = new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    throw rejectedError;
  };
}

function seedSession(user: Record<string, unknown> | string, token: string | null = 'tok') {
  if (token !== null) localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', typeof user === 'string' ? user : JSON.stringify(user));
}

async function rejectionOf(request: Promise<unknown>): Promise<unknown> {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to be rejected');
}

const sentHeader = (name: string) => sentConfig?.headers.get(name);

describe('api request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    sentConfig = undefined;
    rejectedError = undefined;
    beforeReply = undefined;
    respondWith(200);
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('sends Authorization and X-Organization-Id for a tenant with a stored organization', async () => {
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);

    await api.get('/anything');

    expect(sentHeader('Authorization')).toBe('Bearer tok');
    expect(sentHeader('X-Organization-Id')).toBe('7');
  });

  it('sends only Authorization when the tenant is in personal mode', async () => {
    seedSession({ id: 5, role: 'tenant' });

    await api.get('/anything');

    expect(sentHeader('Authorization')).toBe('Bearer tok');
    expect(sentHeader('X-Organization-Id')).toBeUndefined();
  });

  it('sends neither header to an anonymous visitor with a leftover key', async () => {
    seedSession({ id: 5, role: 'tenant' }, null);
    writeStoredOrganizationId(5, 7);

    await api.get('/anything');

    expect(sentHeader('Authorization')).toBeUndefined();
    expect(sentHeader('X-Organization-Id')).toBeUndefined();
  });

  it('sends no organization header when auth_user is unparsable', async () => {
    seedSession('{not json');
    writeStoredOrganizationId(5, 7);

    await api.get('/anything');

    expect(sentHeader('Authorization')).toBe('Bearer tok');
    expect(sentHeader('X-Organization-Id')).toBeUndefined();
  });

  it('sends no organization header when the stored value is invalid', async () => {
    seedSession({ id: 5, role: 'tenant' });
    localStorage.setItem('active_context:5', 'abc');

    await api.get('/anything');

    expect(sentHeader('X-Organization-Id')).toBeUndefined();
  });

  it('sends no organization header for a landlord with a stored key', async () => {
    seedSession({ id: 5, role: 'landlord' });
    writeStoredOrganizationId(5, 7);

    await api.get('/anything');

    expect(sentHeader('Authorization')).toBe('Bearer tok');
    expect(sentHeader('X-Organization-Id')).toBeUndefined();
  });

  it('uses only the key of the user currently in auth_user', async () => {
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);
    await api.get('/anything');
    expect(sentHeader('X-Organization-Id')).toBe('7');

    seedSession({ id: 6, role: 'tenant' });
    await api.get('/anything');
    expect(sentHeader('X-Organization-Id')).toBeUndefined();

    writeStoredOrganizationId(6, 9);
    await api.get('/anything');
    expect(sentHeader('X-Organization-Id')).toBe('9');
  });
});

describe('api response interceptor', () => {
  const forcedPersonal = vi.fn();
  let unsubscribe: () => void;

  beforeEach(() => {
    localStorage.clear();
    sentConfig = undefined;
    rejectedError = undefined;
    beforeReply = undefined;
    forcedPersonal.mockClear();
    unsubscribe = subscribeToForcedPersonal(forcedPersonal);
    seedSession({ id: 5, role: 'tenant' });
    writeStoredOrganizationId(5, 7);
  });

  afterEach(() => {
    unsubscribe();
    api.defaults.adapter = originalAdapter;
  });

  it('demotes to personal on the header 403 and rejects the original error', async () => {
    respondWith(403, { message: ORGANIZATION_FORBIDDEN_MESSAGE });

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(sentHeader('X-Organization-Id')).toBe('7');
    expect(localStorage.getItem('active_context:5')).toBeNull();
    expect(forcedPersonal).toHaveBeenCalledTimes(1);
  });

  it('leaves the context alone on a role 403 with another message', async () => {
    respondWith(403, { message: 'No autorizado' });

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });

  it.each([401, 422, 500])('leaves the context alone on a %s', async (status) => {
    respondWith(status, { message: ORGANIZATION_FORBIDDEN_MESSAGE });

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });

  it('leaves the context alone on a network error', async () => {
    failWithNetworkError();

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });

  it('ignores the header 403 when the failed request carried no organization header', async () => {
    localStorage.removeItem('active_context:5');
    respondWith(403, { message: ORGANIZATION_FORBIDDEN_MESSAGE });
    beforeReply = () => writeStoredOrganizationId(5, 7);

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(sentHeader('X-Organization-Id')).toBeUndefined();
    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });

  it('ignores a late 403 whose header differs from the organization stored now', async () => {
    respondWith(403, { message: ORGANIZATION_FORBIDDEN_MESSAGE });
    beforeReply = () => writeStoredOrganizationId(5, 9);

    const error = await rejectionOf(api.get('/anything'));

    expect(error).toBe(rejectedError);

    expect(sentHeader('X-Organization-Id')).toBe('7');
    expect(localStorage.getItem('active_context:5')).toBe('9');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });

  it('passes a successful response through untouched', async () => {
    respondWith(200, { ok: true });

    const response = await api.get('/anything');

    expect(response.data).toEqual({ ok: true });
    expect(localStorage.getItem('active_context:5')).toBe('7');
    expect(forcedPersonal).not.toHaveBeenCalled();
  });
});
