import { createContext } from "react";

export interface AuthUser {
  id: number;
  name: string;
  lastname: string;
  email: string;
  phone?: string;
  role: "admin" | "landlord" | "tenant";
  landlord?: { id: number; [key: string]: unknown } | null;
  tenant?: { id: number; [key: string]: unknown } | null;
  [key: string]: unknown;
}

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
