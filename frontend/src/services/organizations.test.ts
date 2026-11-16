import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: mockApi,
}));

import {
  createOrganization,
  getOrganizations,
  getOrganizationWallet,
  getWalletMovements,
  topUpWallet,
} from './organizations';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

function sentFormData(): FormData {
  return mockApi.post.mock.calls[0][1] as FormData;
}

describe('organizations service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createOrganization posts multipart FormData to /organizations', () => {
    createOrganization({ name: 'Acme', ruc: '1790012345001', email: 'a@acme.com' });

    expect(mockApi.post).toHaveBeenCalledWith('/organizations', expect.any(FormData), MULTIPART);
  });

  it('puts name, ruc and email in the FormData', () => {
    createOrganization({ name: 'Acme', ruc: '1790012345001', email: 'a@acme.com' });

    const body = sentFormData();
    expect(body.get('name')).toBe('Acme');
    expect(body.get('ruc')).toBe('1790012345001');
    expect(body.get('email')).toBe('a@acme.com');
  });

  it('appends the logo File when one is given', () => {
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });

    createOrganization({ name: 'Acme', ruc: '1790012345001', email: 'a@acme.com', logo });

    const sent = sentFormData().get('logo');
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe('logo.png');
  });

  it.each([null, undefined])('sends no logo key when logo is %s', (logo) => {
    createOrganization({ name: 'Acme', ruc: '1790012345001', email: 'a@acme.com', logo });

    expect(sentFormData().has('logo')).toBe(false);
  });

  it('getOrganizations calls GET /organizations', () => {
    getOrganizations();

    expect(mockApi.get).toHaveBeenCalledWith('/organizations');
  });

  it('getOrganizationWallet calls the path-addressed wallet endpoint', () => {
    getOrganizationWallet(7);

    expect(mockApi.get).toHaveBeenCalledWith('/organizations/7/wallet');
  });

  it('getWalletMovements calls the path-addressed movements endpoint', () => {
    getWalletMovements(7);

    expect(mockApi.get).toHaveBeenCalledWith('/organizations/7/wallet/movements');
  });

  it('topUpWallet posts only the amount string to the top-ups endpoint', () => {
    topUpWallet(7, '100.50');

    expect(mockApi.post).toHaveBeenCalledWith('/organizations/7/wallet/top-ups', { amount: '100.50' });
  });
});
