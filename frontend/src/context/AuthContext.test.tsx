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

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de <AuthProvider>'
    );
  });
});
