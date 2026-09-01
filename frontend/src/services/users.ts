import api from "../api/axios";

export function registerUser(data: Record<string, unknown>) {
  return api.post("/user", data);
}

export function getUsers() {
  return api.get("/user");
}
