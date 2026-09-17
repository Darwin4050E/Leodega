import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockCreatePayment = vi.hoisted(() => vi.fn());

vi.mock("../services/reservations", () => ({
  createPayment: mockCreatePayment,
}));

import BookingCheckout from "./BookingCheckout";

const storeRoom = {
  image: "photo-0.jpg",
  title: "Bodega Norte",
  direction: "Av. Siempre Viva 123",
  city: "Quito",
  ratingAvg: 4.2,
  ratingCount: 8,
};

const reservation = {
  id: 42,
  start_date: "2030-01-10",
  end_date: "2030-04-10",
  total_mount: "2574.00",
  rent_subtotal: "2340.00",
};

function fillValidCard(cardNumber = "4242 4242 4242 4242") {
  fireEvent.change(screen.getByLabelText("Número de tarjeta"), { target: { value: cardNumber } });
  fireEvent.change(screen.getByLabelText("Titular de la tarjeta"), { target: { value: "María López" } });
  fireEvent.change(screen.getByLabelText("Vencimiento"), { target: { value: "1225" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
}

describe("BookingCheckout", () => {
  const onPaid = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders card fields in prototype order: number, holder, then expiry+CVV", () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    const labels = screen.getAllByText(/Número de tarjeta|Titular de la tarjeta|Vencimiento|CVV/);
    expect(labels.map((l) => l.textContent)).toEqual([
      "Número de tarjeta",
      "Titular de la tarjeta",
      "Vencimiento",
      "CVV",
    ]);
  });

  it('CTA reads "Confirmar y pagar $X" where X equals reservation.total_mount, with no client-side arithmetic', () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    expect(screen.getByRole("button", { name: "Confirmar y pagar $2,574" })).toBeInTheDocument();
  });

  it("disables submit until fields pass the readiness check", () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    const submit = screen.getByRole("button", { name: /Confirmar y pagar/ });
    expect(submit).toBeDisabled();

    fillValidCard();
    expect(submit).not.toBeDisabled();
  });

  it("shows the decline banner and does NOT call createPayment for a 0000-prefixed card", async () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    fillValidCard("0000 1111 2222 3333");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y pagar/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/rechazó la tarjeta/)).toBeInTheDocument();
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("calls createPayment exactly once with the exact payload for a valid non-0000 card", async () => {
    mockCreatePayment.mockResolvedValue({ data: { message: "ok", payment: { id: 1 } } });

    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    fillValidCard();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y pagar/ }));

    await waitFor(() => expect(mockCreatePayment).toHaveBeenCalledTimes(1));

    const [payload] = mockCreatePayment.mock.calls[0];
    expect(payload).toMatchObject({
      reservation_id: 42,
      payment_method: "credit card",
      payment_state: "paid",
    });
    expect(payload).not.toHaveProperty("card_number");
    expect(payload).not.toHaveProperty("card_holder");
    expect(payload).not.toHaveProperty("expiry");
    expect(payload).not.toHaveProperty("cvv");

    await waitFor(() => expect(onPaid).toHaveBeenCalledWith(reservation));
  });

  it("disables the button while paying is true (double-submit guard): rapid double-click calls createPayment at most once", async () => {
    let resolvePayment: (value: unknown) => void = () => {};
    mockCreatePayment.mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve;
      })
    );

    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    fillValidCard();
    const submit = screen.getByRole("button", { name: /Confirmar y pagar/ });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(submit).toBeDisabled();
    expect(mockCreatePayment).toHaveBeenCalledTimes(1);

    resolvePayment({ data: { message: "ok", payment: { id: 1 } } });
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it("shows a distinct retryable error (not the decline banner) on a non-401 createPayment rejection, and re-enables the button", async () => {
    mockCreatePayment.mockRejectedValue({ response: { status: 500 } });

    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    fillValidCard();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y pagar/ }));

    await waitFor(() =>
      expect(screen.getByText("Ocurrió un error procesando el pago. Intenta de nuevo.")).toBeInTheDocument()
    );
    expect(screen.queryByText(/rechazó la tarjeta/)).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /Confirmar y pagar/ });
    expect(submit).not.toBeDisabled();
  });

  it("shows the login-required copy on a 401 createPayment rejection without dropping back to detail", async () => {
    mockCreatePayment.mockRejectedValue({ response: { status: 401 } });

    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    fillValidCard();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y pagar/ }));

    await waitFor(() =>
      expect(screen.getByText("Debes iniciar sesión para completar el pago.")).toBeInTheDocument()
    );
    expect(onBack).not.toHaveBeenCalled();
  });

  it('"← Volver al detalle" calls onBack when not submitting, and is disabled while submitting', async () => {
    let resolvePayment: (value: unknown) => void = () => {};
    mockCreatePayment.mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve;
      })
    );

    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    const backButton = screen.getByRole("button", { name: "← Volver al detalle" });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);

    fillValidCard();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar y pagar/ }));
    expect(backButton).toBeDisabled();

    resolvePayment({ data: { message: "ok", payment: { id: 1 } } });
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
  });

  it("renders the demo disclosure line and the Pago simulado line", () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    expect(screen.getByText("Pago simulado — no se realiza ningún cargo real.")).toBeInTheDocument();
    expect(
      screen.getByText(/Pago cifrado y seguro · demo: una tarjeta que empiece con 0000 simula un rechazo/)
    ).toBeInTheDocument();
  });

  it("renders the instant-confirmation info callout in the summary panel (fidelity: BookingFlow.jsx:339)", () => {
    render(
      <BookingCheckout storeRoom={storeRoom} reservation={reservation} pricePerMonth={780} onPaid={onPaid} onBack={onBack} />
    );

    expect(
      screen.getByText("El pago confirma la reserva de inmediato. Sin aprobación del gestor.")
    ).toBeInTheDocument();
  });
});
