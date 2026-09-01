import api from "../api/axios";

export function getProfile() {
  return api.get("/profile");
}

export function updateProfile(data: {
  name: string;
  lastname: string;
  email: string;
  phone: string;
}) {
  return api.put("/profile", data);
}

export function changePassword(data: Record<string, unknown>) {
  return api.put("/password", data);
}

export function getSessions() {
  return api.get("/sessions");
}

export function deleteSession(tokenId: number | string) {
  return api.delete(`/sessions/${tokenId}`);
}

export function deleteAccount() {
  return api.delete("/account");
}
