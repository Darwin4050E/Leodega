import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockGetStoreRoomQuote = vi.hoisted(() => vi.fn());

vi.mock("../services/storeRooms", () => ({
  getStoreRoomQuote: mockGetStoreRoomQuote,
}));

import PriceBreakdownPanel from "./PriceBreakdownPanel";

describe("PriceBreakdownPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Calculando..." while the quote request is in flight', () => {
    mockGetStoreRoomQuote.mockReturnValue(new Promise(() => {}));

    render(<PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />);

    expect(screen.getByText("Calculando...")).toBeInTheDocument();
  });

  it("renders exactly two lines with matching amounts once the quote resolves", async () => {
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: "2340.00", service_fee: "140.40", deposit: "0.00", total_mount: "2340.00" },
    });

    render(<PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />);

    await waitFor(() => expect(screen.getByText(/\$780 × 3 meses/)).toBeInTheDocument());

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("$2,340")).toHaveLength(2);
  });

  it("shows the no-eligible-price copy on a 422 response", async () => {
    mockGetStoreRoomQuote.mockRejectedValue({ response: { status: 422, data: { message: "No hay un precio mensual disponible para esta bodega." } } });

    render(<PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />);

    await waitFor(() =>
      expect(screen.getByText("No hay un precio mensual disponible para esta bodega.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Calculando...")).not.toBeInTheDocument();
  });

  it("shows a distinct generic-error copy on a network/5xx failure", async () => {
    mockGetStoreRoomQuote.mockRejectedValue(new Error("network error"));

    render(<PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />);

    await waitFor(() =>
      expect(screen.getByText("No se pudo calcular el precio. Intenta de nuevo.")).toBeInTheDocument()
    );
    expect(
      screen.queryByText("No hay un precio mensual disponible para esta bodega.")
    ).not.toBeInTheDocument();
  });

  it("does not render a deposit row when deposit is zero", async () => {
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: "2340.00", service_fee: "140.40", deposit: "0.00", total_mount: "2340.00" },
    });

    render(<PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />);

    await waitFor(() => expect(screen.getByText("Total")).toBeInTheDocument());

    expect(screen.queryByText("Depósito de garantía")).not.toBeInTheDocument();
  });

  it("renders zero <input> elements — the panel is display-only", async () => {
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: "2340.00", service_fee: "140.40", deposit: "0.00", total_mount: "2340.00" },
    });

    const { container } = render(
      <PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="" endDate="" />
    );

    await waitFor(() => expect(screen.getByText("Total")).toBeInTheDocument());

    expect(container.querySelectorAll("input")).toHaveLength(0);
  });

  it("re-fetches the quote when a complete valid date range is provided", async () => {
    mockGetStoreRoomQuote.mockResolvedValue({
      data: { rent_subtotal: "1560.00", service_fee: "93.60", deposit: "0.00", total_mount: "1560.00" },
    });

    render(
      <PriceBreakdownPanel roomId={7} pricePerMonth={780} startDate="2030-01-10" endDate="2030-03-10" />
    );

    await waitFor(() =>
      expect(mockGetStoreRoomQuote).toHaveBeenCalledWith(7, "2030-01-10", "2030-03-10")
    );
  });
});
