import { useCallback, useState, type ReactNode } from "react";
import { AuthContext, type AuthUser } from "./authContextBase";

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fuente única de la sesión (token + usuario) para toda la app, en vez de
 * que cada componente lea/escriba auth_token/auth_user en localStorage por
 * su cuenta. localStorage se mantiene como almacenamiento real (para que la
 * sesión sobreviva un refresh) — este contexto es la capa de lectura/escritura
 * que los componentes React deben usar en su lugar.
 *
 * Excepción a propósito: src/api/axios.ts sigue leyendo localStorage
 * directamente, porque el interceptor de axios no es un componente React y
 * no puede usar hooks.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem("auth_token", newToken);
    localStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
