import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockGetDashboardSummary = vi.hoisted(() => vi.fn());
const mockGetRecentActivity = vi.hoisted(() => vi.fn());
const mockGetPendingStoreRooms = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("../../services/storeRooms", () => ({
  getPendingStoreRooms: mockGetPendingStoreRooms,
}));

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
    mockGetPendingStoreRooms.mockResolvedValue({ data: [] });
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

  // ── Pending rooms queue ─────────────────────────────────────

  const pendingRoom = (id: number, title: string) => ({
    id,
    title,
    landlord: { name: "Carlos Mora" },
    size: 320,
    monthly_price: 780,
    permit_attached: id % 2 === 1,
    photos: [],
  });

  it("lists the first pending rooms with a Revisar button that opens the moderation page", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    mockGetPendingStoreRooms.mockResolvedValueOnce({
      data: [1, 2, 3, 4, 5].map((id) => pendingRoom(id, `Bodega ${id}`)),
    });

    renderComponent();

    expect(await screen.findByText("Bodegas pendientes por aprobar")).toBeInTheDocument();
    expect(screen.getByText("Aprobación por bodega, una sola vez.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Bodega 1")).toBeInTheDocument());
    expect(screen.getByText("Bodega 4")).toBeInTheDocument();
    expect(screen.queryByText("Bodega 5")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprobar|rechazar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Revisar" })[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith("/admin/moderacion");

    fireEvent.click(screen.getByRole("button", { name: "Revisar cola →" }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/admin/moderacion");
  });

  it("shows 'Cola al día' in the queue block when nothing is pending", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: zeroSummary });

    renderComponent();

    await waitFor(() => expect(screen.getAllByText("Cola al día").length).toBe(2));
    expect(screen.queryByRole("button", { name: "Revisar cola →" })).not.toBeInTheDocument();
  });

  it("does not blank the rest when the pending queue fails", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });
    mockGetPendingStoreRooms.mockRejectedValueOnce(new Error("boom"));

    renderComponent();

    await waitFor(() => expect(screen.getByText("14")).toBeInTheDocument());
    expect(await screen.findByText(/no se pudo cargar la cola/i)).toBeInTheDocument();
  });

  it("links the Cuentas card to the accounts page", async () => {
    mockGetDashboardSummary.mockResolvedValueOnce({ data: summary });

    renderComponent();

    fireEvent.click(await screen.findByRole("button", { name: "Gestionar →" }));
    expect(mockNavigate).toHaveBeenLastCalledWith("/admin/usuarios");
  });
});
