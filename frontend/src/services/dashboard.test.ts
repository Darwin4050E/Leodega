import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../api/axios", () => ({
  default: mockApi,
}));

import { getDashboardSummary, getRecentActivity } from "./dashboard";

describe("dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Summary metrics ──────────────────────────────────────────────────────────

  it("getDashboardSummary calls GET /dashboard/summary", async () => {
    const summary = {
      active_store_rooms: 3,
      pending_moderation: 1,
      reservations_this_month: 5,
      open_reports: 0,
      accounts: { total: 10, blocked: 2 },
    };
    mockApi.get.mockResolvedValueOnce({ data: summary });

    const result = await getDashboardSummary();

    expect(mockApi.get).toHaveBeenCalledWith("/dashboard/summary");
    expect(result.data).toEqual(summary);
  });

  it("getDashboardSummary propagates the rejection shape from asApiError", async () => {
    mockApi.get.mockRejectedValueOnce({
      response: { status: 403, data: { message: "Prohibido" } },
    });

    await expect(getDashboardSummary()).rejects.toMatchObject({
      response: { status: 403, data: { message: "Prohibido" } },
    });
  });

  // ── Activity feed ──────────────────────────────────────────────────────────

  it("getRecentActivity calls GET /dashboard/activity with the default limit", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });

    await getRecentActivity();

    expect(mockApi.get).toHaveBeenCalledWith("/dashboard/activity", { params: { limit: 10 } });
  });

  it("getRecentActivity forwards a custom limit", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });

    await getRecentActivity(5);

    expect(mockApi.get).toHaveBeenCalledWith("/dashboard/activity", { params: { limit: 5 } });
  });

  it("getRecentActivity propagates the rejection shape from asApiError", async () => {
    mockApi.get.mockRejectedValueOnce({
      response: { status: 401, data: { message: "No autenticado" } },
    });

    await expect(getRecentActivity()).rejects.toMatchObject({
      response: { status: 401, data: { message: "No autenticado" } },
    });
  });
});
