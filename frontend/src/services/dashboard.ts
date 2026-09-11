import api from "../api/axios";

// ── Dashboard summary metrics ──────────────────────────────────

export interface DashboardSummary {
  active_store_rooms: number;
  pending_moderation: number;
  reservations_this_month: number;
  open_reports: number;
  accounts: { total: number; blocked: number };
}

export function getDashboardSummary() {
  return api.get<DashboardSummary>("/dashboard/summary");
}

// ── Merged activity feed ───────────────────────────────────────

export type Action = "approved" | "rejected" | "blocked" | "reactivated";

export interface ActivityEntry {
  id: string;
  actor: string | null;
  action: Action;
  target: string;
  occurred_at: string;
  tone: "ok" | "err";
  note: string | null;
}

export function getRecentActivity(limit = 10) {
  return api.get<ActivityEntry[]>("/dashboard/activity", { params: { limit } });
}
