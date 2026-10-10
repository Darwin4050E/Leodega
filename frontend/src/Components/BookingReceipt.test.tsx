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

  // HUE-05 OR-WS6/WS7
  it("shows the organization name and RUC when the reservation carries one", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={{ ...reservation, organization: { id: 5, name: "Andina", ruc: "1792146739001" } }}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText(/Andina/)).toBeInTheDocument();
    expect(screen.getByText(/1792146739001/)).toBeInTheDocument();
  });

  it("shows no organization row for a personal reservation", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.queryByText("A nombre de")).not.toBeInTheDocument();
  });

  // org-wallet OW-WS13/WS14
  it("shows 'Pagado con' and 'Saldo de {org}' for a wallet-paid organization reservation", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={{
          ...reservation,
          payment_method: "wallet",
          organization: { id: 5, name: "Andina", ruc: "1792146739001" },
        }}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText("Pagado con")).toBeInTheDocument();
    expect(screen.getByText("Saldo de Andina")).toBeInTheDocument();
  });

  it("shows no payment method row for a personal reservation", () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.queryByText("Pagado con")).not.toBeInTheDocument();
    expect(screen.queryByText(/Saldo de/)).not.toBeInTheDocument();
  });
});
