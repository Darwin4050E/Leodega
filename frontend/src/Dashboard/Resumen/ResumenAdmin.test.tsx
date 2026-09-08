import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockGetDashboardSummary = vi.hoisted(() => vi.fn());
const mockGetRecentActivity = vi.hoisted(() => vi.fn());

vi.mock("../../services/dashboard", () => ({
  getDashboardSummary: mockGetDashboardSummary,
  getRecentActivity: mockGetRecentActivity,
}));

import ResumenAdmin from "./ResumenAdmin";

const summary = {
  active_store_rooms: 14,
  pending_moderation: 3,
  reservations_this_month: 32,
  open_reports: 2,
  accounts: { total: 20, blocked: 4 },
};

const zeroSummary = {
  active_store_rooms: 0,
  pending_moderation: 0,
  reservations_this_month: 0,
  open_reports: 0,
  accounts: { total: 0, blocked: 0 },
};

const activityEntries = [
  {
    id: "store:1",
    actor: "Admin Leodega",
    action: "approved" as const,
    target: "Galpón Logístico",
    occurred_at: "2026-09-08T10:00:00Z",
    tone: "ok" as const,
    note: null,
  },
  {
    id: "account:1",
    actor: "Admin Leodega",
    action: "blocked" as const,
    target: "Juan Martínez",
    occurred_at: "2026-09-07T10:00:00Z",
    tone: "err" as const,
    note: null,
  },
];

function renderComponent() {
  return render(
    <MemoryRouter>
      <ResumenAdmin />
    </MemoryRouter>,
  );
}

describe("ResumenAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecentActivity.mockResolvedValue({ data: [] });
  });

  // ── Metric cards ────────────────────────────────────────────

  it("shows a loading indicator while the summary request is in flight", () => {
    mockGetDashboardSummary.mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(screen.getByText(/cargando métricas/i)).toBeInTheDocument();
  });

  it("renders the five metric cards with correct values, including accounts total+blocked", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });

    renderComponent();

    await waitFor(() => expect(screen.getByText("14")).toBeInTheDocument());
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders all-zero metrics normally, not as an error", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: zeroSummary });

    renderComponent();

    await waitFor(() => expect(screen.getAllByText("0").length).toBeGreaterThan(0));
    expect(screen.queryByText(/no se pudieron cargar/i)).not.toBeInTheDocument();
  });

  it("shows an error message with retry on summary fetch failure, and retry re-issues the request", async () => {
    mockGetDashboardSummary.mockRejectedValueOnce({
      response: { status: 500, data: { message: "Error del servidor" } },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText("Error del servidor")).toBeInTheDocument());

    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    fireEvent.click(screen.getByText("Reintentar"));

    await waitFor(() => expect(screen.getByText("14")).toBeInTheDocument());
    expect(mockGetDashboardSummary).toHaveBeenCalledTimes(2);
  });

  // ── Activity feed ───────────────────────────────────────────

  it("renders the activity list in order", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    mockGetRecentActivity.mockResolvedValueOnce({ data: activityEntries });

    renderComponent();

    await waitFor(() => expect(screen.getByText(/galpón logístico/i)).toBeInTheDocument());
    const items = screen.getAllByText((_, el) => el?.tagName === "P" && /aprobó|bloqueó/.test(el.textContent ?? ""));
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty-state message when activity is empty", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    mockGetRecentActivity.mockResolvedValueOnce({ data: [] });

    renderComponent();

    await waitFor(() => expect(screen.getByText(/sin actividad reciente/i)).toBeInTheDocument());
  });

  it("does not blank the metric cards when the activity fetch fails", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    mockGetRecentActivity.mockRejectedValueOnce({
      response: { status: 500, data: { message: "Error de actividad" } },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText("Error de actividad")).toBeInTheDocument());
    expect(screen.getByText("14")).toBeInTheDocument();
  });
});
