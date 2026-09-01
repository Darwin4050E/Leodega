import api from "../api/axios";

export function login(email: string, password: string) {
  return api.post("/login", { email, password });
}

export function logoutRequest(token: string | null) {
  return api.post(
    "/logout",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export function forgotPassword(email: string) {
  return api.post("/forgot-password", { email });
}

export function resetPassword(data: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}) {
  return api.post("/reset-password", data);
}
