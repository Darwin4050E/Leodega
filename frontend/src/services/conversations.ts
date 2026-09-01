import api from "../api/axios";

export function getMe() {
  return api.get("/me");
}

export function getConversations() {
  return api.get("/conversations");
}

export function getMessages(conversationId: number | string) {
  return api.get(`/conversations/${conversationId}/messages`);
}

export function markConversationRead(conversationId: number | string) {
  return api.post(`/conversations/${conversationId}/read`);
}

export function sendMessage(conversationId: number | string, formData: FormData) {
  return api.post(`/conversations/${conversationId}/messages`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function createConversation(userId: number | string) {
  return api.post("/conversations", { user_id: userId });
}
