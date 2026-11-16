import api from "../api/axios";

export type UserState = "active" | "blocked" | "pending";

export interface UserListItem {
  id: number;
  name: string;
  lastname: string;
  email: string;
  role: "admin" | "landlord" | "tenant";
  state: UserState;
  /** ISO timestamp; present because the admin index returns the full row. */
  created_at?: string;
}

export function registerUser(data: Record<string, unknown>) {
  return api.post("/user", data);
}

export function getUsers() {
  return api.get<UserListItem[]>("/user");
}

export function blockUser(id: number, reason: string) {
  return api.patch(`/user/${id}/block`, { reason });
}

export function reactivateUser(id: number) {
  return api.patch(`/user/${id}/reactivate`);
}
