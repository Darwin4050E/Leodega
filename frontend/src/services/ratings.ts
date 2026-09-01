import api from "../api/axios";

export function rateStoreRoom(data: {
  store_id: number;
  stars: number;
  comment: string;
}) {
  return api.post("/ratings", data);
}
