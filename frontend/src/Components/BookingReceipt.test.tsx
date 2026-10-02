import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockDownloadReservationReceipt = vi.hoisted(() => vi.fn());

vi.mock("../utils/receiptDownload", () => ({
  downloadReservationReceipt: mockDownloadReservationReceipt,
}));

import BookingReceipt from "./BookingReceipt";

const storeRoom = {
  image: "photo-0.jpg",
  title: "Bodega Norte",
  direction: "Av. Siempre Viva 123",
  city: "Quito",
  size: 20,
  gestorName: "Laura Gomez",
};

const reservation = {
  id: 42,
  start_date: "2030-01-10",
  end_date: "2030-04-10",
  total_mount: "2574.00",
  rent_subtotal: "2340.00",
};

describe("BookingReceipt", () => {
  const onViewReservations = vi.fn();
  const onBackToCatalog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the reservation code derived from reservation.id via formatReservationCode, not Math.random()", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText("LEO-000042")).toBeInTheDocument();
  });

  it('shows "Enviamos el comprobante a tu correo" (REQ-REC-1 corrected — email dispatch really ships)', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText(/Enviamos el comprobante a tu correo/)).toBeInTheDocument();
  });

  it('renders the "PAGADA" badge unconditionally, with no network call required', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText(/PAGADA/)).toBeInTheDocument();
    expect(screen.queryByText(/PAGADO/)).not.toBeInTheDocument();
  });

  it('"Monto pagado" equals reservation.total_mount exactly, no client-side addition', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText("Monto pagado")).toBeInTheDocument();
    expect(screen.getByText(/\$2,574/)).toBeInTheDocument();
  });

  it("shows the period/duration/gestor grid from reservation dates and the already-loaded landlord name", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText("2030-01-10")).toBeInTheDocument();
    expect(screen.getByText("2030-04-10")).toBeInTheDocument();
    expect(screen.getByText("3 meses")).toBeInTheDocument();
    expect(screen.getByText("Laura Gomez")).toBeInTheDocument();
  });

  it('"Descargar PDF" downloads the real receipt for the reservation, with no demo toast', async () => {
    let resolveDownload: () => void = () => {};
    mockDownloadReservationReceipt.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDownload = resolve;
      })
    );
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    expect(mockDownloadReservationReceipt).toHaveBeenCalledWith(42);
    expect(screen.getByRole("button", { name: "Descargando..." })).toBeDisabled();

    resolveDownload();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeEnabled();
    });
    expect(screen.queryByText(/Comprobante PDF descargado/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('"Descargar PDF" shows the generic error on failure and leaves the screen intact', async () => {
    mockDownloadReservationReceipt.mockRejectedValue(
      new Error("No se pudo descargar el comprobante. Inténtalo de nuevo.")
    );
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo descargar el comprobante. Inténtalo de nuevo."
    );
    expect(screen.getByText("LEO-000042")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mis reservas" })).toBeInTheDocument();
    expect(screen.queryByText(/Comprobante PDF descargado/)).not.toBeInTheDocument();
  });

  it('"Ver mis reservas" calls onViewReservations', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver mis reservas" }));

    expect(onViewReservations).toHaveBeenCalledTimes(1);
  });

  it('"Volver al catálogo" calls onBackToCatalog', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Volver al catálogo" }));

    expect(onBackToCatalog).toHaveBeenCalledTimes(1);
  });
});
