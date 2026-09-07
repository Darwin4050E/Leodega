import api from "../api/axios";

export type UserState = "active" | "blocked" | "pending";

export interface UserListItem {
  id: number;
  name: string;
  lastname: string;
  email: string;
  role: "admin" | "landlord" | "tenant";
  state: UserState;
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
