import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import type { AuthUser } from './authContextBase';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const sampleUser: AuthUser = {
  id: 1,
  name: 'Ana',
  lastname: 'Pérez',
  email: 'ana@example.com',
  role: 'tenant',
};

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with token/user null when localStorage is empty', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('hydrates initial state from localStorage', () => {
    localStorage.setItem('auth_token', 'abc123');
    localStorage.setItem('auth_user', JSON.stringify(sampleUser));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe('abc123');
    expect(result.current.user).toEqual(sampleUser);
  });

  it('falls back to null user when auth_user is corrupted JSON', () => {
    localStorage.setItem('auth_token', 'abc123');
    localStorage.setItem('auth_user', '{not valid json');

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
  });

  it('login stores token/user in localStorage and updates state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('newtoken', sampleUser);
    });

    expect(result.current.token).toBe('newtoken');
    expect(result.current.user).toEqual(sampleUser);
    expect(localStorage.getItem('auth_token')).toBe('newtoken');
    expect(localStorage.getItem('auth_user')).toBe(JSON.stringify(sampleUser));
  });

  it('logout clears token/user from state and localStorage', () => {
    localStorage.setItem('auth_token', 'abc123');
    localStorage.setItem('auth_user', JSON.stringify(sampleUser));

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  it('logout removes the active context key of the user that is leaving and no other', () => {
    localStorage.setItem('auth_token', 'abc123');
    localStorage.setItem('auth_user', JSON.stringify(sampleUser));
    localStorage.setItem('active_context:1', '7');
    localStorage.setItem('active_context:2', '9');

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('active_context:1')).toBeNull();
    expect(localStorage.getItem('active_context:2')).toBe('9');
  });

  it('logout without a stored session leaves every active context key alone', () => {
    localStorage.setItem('active_context:1', '7');

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem('active_context:1')).toBe('7');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de <AuthProvider>'
    );
  });
});
