import { describe, it, expect } from 'vitest';
import { asApiError } from './errors';

describe('asApiError', () => {
  it('returns the same object reference for a typical axios error', () => {
    const error = { response: { status: 422, data: { message: 'Invalid' } } };
    expect(asApiError(error)).toBe(error);
  });

  it('exposes nested response.data fields via optional chaining', () => {
    const error = { response: { status: 404, data: { error: 'Not found' } } };
    const result = asApiError(error);
    expect(result.response?.status).toBe(404);
    expect(result.response?.data?.error).toBe('Not found');
  });

  it('falls back to an empty object for null', () => {
    expect(asApiError(null)).toEqual({});
  });

  it('falls back to an empty object for undefined', () => {
    expect(asApiError(undefined)).toEqual({});
  });

  it('leaves a plain Error object accessible without throwing', () => {
    const error = new Error('boom');
    const result = asApiError(error);
    expect(result.message).toBe('boom');
    expect(result.response).toBeUndefined();
  });
});
