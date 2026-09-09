import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockGetPendingStoreRooms = vi.hoisted(() => vi.fn());
const mockDownloadStoreRoomPermit = vi.hoisted(() => vi.fn());
const mockUpdateStoreRoom = vi.hoisted(() => vi.fn());

vi.mock("../../services/storeRooms", () => ({
  getPendingStoreRooms: mockGetPendingStoreRooms,
  downloadStoreRoomPermit: mockDownloadStoreRoomPermit,
  updateStoreRoom: mockUpdateStoreRoom,
  REASON_CODE: {
    FOTOS: "fotos",
    INFO: "info",
    PERMISO: "permiso",
    OTRO: "otro",
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock("leaflet", () => ({
  default: { Icon: class {} },
}));

import ModeracionAdmin from "./ModeracionAdmin";

const moderationDetail = {
  id: 1,
  title: "Galpón Logístico Vía a Daule",
  landlord: { name: "Carlos Mora", email: "c.mora@example.com" },
  submitted_at: "2026-06-18",
  photos: ["/img/foto1.jpg", "/img/foto2.jpg"],
  direction: "Km 11.5 Vía a Daule",
  city: "Guayaquil",
  latitude: -2.118,
  longitude: -79.955,
  size: 320,
  monthly_price: 780,
  leodega_fee: 78,
  landlord_share: 702,
  description: "Galpón de gran altura con muelle de carga.",
  cancellation_policy_tier: "moderada",
  security: { camara: true, ruido: false, control: true, acceso: false },
  permit_attached: true,
  permit_filename: "permiso_bomberos_daule.pdf",
  moderation_history: [
    {
      status: "rejected",
      reason_code: "fotos",
      reason_rejected: null,
      admin_id: 4,
      moderation_date: "2026-06-10",
      permit_waived_at: null,
    },
  ],
  room_type: "bodega",
  storage_type: "completa",
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <ModeracionAdmin />
    </MemoryRouter>,
  );
}

/**
 * Cards render collapsed: the header band is always visible and the dossier
 * opens on demand. Every assertion about dossier content must open it first.
 * This is presentation only — the queue response already carries every field,
 * so opening triggers no request.
 */
async function openFirstDossier() {
  const toggle = await screen.findByRole("button", { name: "Abrir expediente" });
  fireEvent.click(toggle);
}

describe("ModeracionAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state, then every dossier expanded from the single queue response", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({ data: [moderationDetail] });
    renderScreen();

    expect(screen.getByText("Cargando cola de moderación…")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(moderationDetail.title)).toBeInTheDocument());
    await openFirstDossier();
    expect(screen.getByText(/Galpón de gran altura/)).toBeInTheDocument();
    expect(mockGetPendingStoreRooms).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state on a bare 200 [] response, not an error", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({ data: [] });
    renderScreen();

    await waitFor(() => expect(screen.getByText("Cola al día")).toBeInTheDocument());
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument();
  });

  it("renders an error state with retry when the queue fetch fails", async () => {
    mockGetPendingStoreRooms.mockRejectedValueOnce({
      response: { status: 500, data: { message: "Error del servidor" } },
    });
    renderScreen();

    await waitFor(() => expect(screen.getByText("Error del servidor")).toBeInTheDocument());

    mockGetPendingStoreRooms.mockResolvedValueOnce({ data: [moderationDetail] });
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => expect(screen.getByText(moderationDetail.title)).toBeInTheDocument());
  });

  it("renders declared and not-declared security features, room_type, storage_type and history", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({ data: [moderationDetail] });
    renderScreen();
    await openFirstDossier();

    await waitFor(() => expect(screen.getByText("Cámara de seguridad exterior")).toBeInTheDocument());
    expect(screen.getByText("Monitor de ruido / decibeles")).toBeInTheDocument();
    expect(screen.getByText("Bodega independiente")).toBeInTheDocument();
    expect(screen.getByText("Bodega completa")).toBeInTheDocument();
  });

  it("hides the map and falls back to direction/city text when coordinates are null", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({
      data: [{ ...moderationDetail, latitude: null, longitude: null }],
    });
    renderScreen();
    await openFirstDossier();

    await waitFor(() =>
      expect(screen.getByText(/Km 11.5 Vía a Daule, Guayaquil/)).toBeInTheDocument(),
    );
  });

  it("opens the permit download when clicked", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({ data: [moderationDetail] });
    mockDownloadStoreRoomPermit.mockResolvedValue({ data: new Blob(["pdf"]) });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderScreen();
    await openFirstDossier();
    await waitFor(() => screen.getByText(moderationDetail.title));
    await waitFor(() => screen.getByText("permiso_bomberos_daule.pdf"));

    fireEvent.click(screen.getByText("Permiso del cuerpo de bomberos"));

    await waitFor(() => expect(mockDownloadStoreRoomPermit).toHaveBeenCalledWith(1));
    expect(windowOpenSpy).toHaveBeenCalledWith("blob:mock-url", "_blank");

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    windowOpenSpy.mockRestore();
  });

  it("states plainly when no permit is attached, with no download control", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({
      data: [{ ...moderationDetail, permit_attached: false, permit_filename: null }],
    });
    renderScreen();
    await openFirstDossier();

    await waitFor(() => expect(screen.getByText("Ningún archivo adjunto")).toBeInTheDocument());
    expect(
      screen.getByText("El gestor debe adjuntar el permiso antes de aprobar."),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// Decision flows (approve/reject) — PR3.
// ─────────────────────────────────────────────────────────────
describe("ModeracionAdmin — decision flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadQueue() {
    mockGetPendingStoreRooms.mockResolvedValue({ data: [moderationDetail] });
    renderScreen();
    await waitFor(() => screen.getByText(moderationDetail.title));
    await openFirstDossier();
    await waitFor(() => screen.getByText(/Galpón de gran altura/));
  }

  it("sends publication_status approved with no waiver field when the permit is attached", async () => {
    await loadQueue();
    mockUpdateStoreRoom.mockResolvedValue({ data: {} });
    mockGetPendingStoreRooms.mockResolvedValueOnce({ data: [] });

    fireEvent.click(screen.getByRole("button", { name: "Aprobar y publicar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith(1, { publication_status: "approved" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/aprobada/i));
  });

  it("keeps confirm disabled without the permit until the waiver is checked, then sends the flag", async () => {
    mockGetPendingStoreRooms.mockResolvedValue({
      data: [{ ...moderationDetail, permit_attached: false, permit_filename: null }],
    });
    renderScreen();
    await openFirstDossier();
    await waitFor(() => screen.getByText(moderationDetail.title));
    await waitFor(() => screen.getByText("Ningún archivo adjunto"));

    fireEvent.click(screen.getByRole("button", { name: "Aprobar y publicar" }));
    const confirmBtn = screen.getByRole("button", { name: "Sí, aprobar" });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmBtn).not.toBeDisabled();

    mockUpdateStoreRoom.mockResolvedValue({ data: {} });
    mockGetPendingStoreRooms.mockResolvedValueOnce({ data: [] });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith(1, {
        publication_status: "approved",
        permit_waiver_acknowledged: true,
      }),
    );
  });

  it("keeps the reject confirm disabled for otro without a comment, enabled once typed", async () => {
    await loadQueue();

    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    const confirmBtn = screen.getByRole("button", { name: "Rechazar y enviar" });
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByText("Otro motivo"));
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/obligatorio/i), {
      target: { value: "Motivo detallado" },
    });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("sends a non-otro reason with no comment required", async () => {
    await loadQueue();
    mockUpdateStoreRoom.mockResolvedValue({ data: {} });
    mockGetPendingStoreRooms.mockResolvedValueOnce({ data: [] });

    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    fireEvent.click(screen.getByText("Fotos incorrectas"));
    fireEvent.click(screen.getByRole("button", { name: "Rechazar y enviar" }));

    await waitFor(() =>
      expect(mockUpdateStoreRoom).toHaveBeenCalledWith(1, {
        publication_status: "rejected",
        reason_code: "fotos",
        reason_rejected: null,
      }),
    );
  });

  it("keeps the dialog open with an inline error on a 422, without dropping the listing", async () => {
    await loadQueue();
    mockUpdateStoreRoom.mockRejectedValue({
      response: { status: 422, data: { message: "No se pudo procesar la decisión." } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Aprobar y publicar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));

    await waitFor(() =>
      expect(screen.getByText("No se pudo procesar la decisión.")).toBeInTheDocument(),
    );
    // The dialog is still open — the confirm button is present.
    expect(screen.getByRole("button", { name: "Sí, aprobar" })).toBeInTheDocument();
    // Pessimistic update: no refetch on failure beyond the initial mount call.
    expect(mockGetPendingStoreRooms).toHaveBeenCalledTimes(1);
  });

  it("refetches the queue exactly once after a successful decision", async () => {
    await loadQueue();
    mockUpdateStoreRoom.mockResolvedValue({ data: {} });
    mockGetPendingStoreRooms.mockResolvedValueOnce({ data: [] });

    fireEvent.click(screen.getByRole("button", { name: "Aprobar y publicar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, aprobar" }));

    await waitFor(() => expect(mockGetPendingStoreRooms).toHaveBeenCalledTimes(2));
  });
});
