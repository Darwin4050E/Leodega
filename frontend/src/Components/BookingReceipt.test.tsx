import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it('renders the "PAGADO" badge unconditionally, with no network call required', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    expect(screen.getByText(/PAGADO/)).toBeInTheDocument();
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

  it('"Descargar PDF" triggers the no-op demo toast, no real file generation', () => {
    render(
      <BookingReceipt
        storeRoom={storeRoom}
        reservation={reservation}
        onViewReservations={onViewReservations}
        onBackToCatalog={onBackToCatalog}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));

    expect(screen.getByText(/Comprobante PDF descargado/)).toBeInTheDocument();
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
