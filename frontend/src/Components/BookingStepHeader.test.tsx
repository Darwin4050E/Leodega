import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BookingStepHeader from "./BookingStepHeader";

describe("BookingStepHeader", () => {
  it('shows "Pago" as current and "Detalle" as completed when step is "pago"', () => {
    render(<BookingStepHeader step="pago" onClose={vi.fn()} />);

    expect(screen.getByText("Detalle")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Comprobante")).toBeInTheDocument();

    // "Detalle" is completed → checkmark.
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it('shows "Detalle" and "Pago" as completed when step is "comprobante"', () => {
    render(<BookingStepHeader step="comprobante" onClose={vi.fn()} />);

    expect(screen.getAllByText("✓")).toHaveLength(2);
    expect(screen.getByText("Comprobante")).toBeInTheDocument();
  });

  it('shows step 1 as current with no checkmarks when step is "detail"', () => {
    render(<BookingStepHeader step="detail" onClose={vi.fn()} />);

    expect(screen.queryByText("✓")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it('renders a "Salir" action that calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<BookingStepHeader step="pago" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /Salir/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
