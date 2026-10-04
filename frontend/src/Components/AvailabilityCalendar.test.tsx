import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { toDateOnlyISO } from "../utils/dates";

describe("AvailabilityCalendar", () => {
  it("shows the loading copy instead of the grid while loading", () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={true} />);

    expect(screen.getByText("Cargando disponibilidad...")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("marks every day inside a reserved range as occupied and disabled", () => {
    const today = new Date();
    const occupiedDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const occupiedISO = toDateOnlyISO(occupiedDay);

    render(
      <AvailabilityCalendar
        reservedRanges={[{ start_date: occupiedISO, end_date: occupiedISO }]}
        loading={false}
      />
    );

    const dayLabel = String(occupiedDay.getDate());
    const button = screen.getByRole("button", { name: dayLabel });
    expect(button).toBeDisabled();
  });

  it("shows all days as available with no occupied markings when reservedRanges is empty", () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={false} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => expect(button).not.toBeDisabled());
  });

  it("marks days from BOTH a reservation-shaped range and a landlord-block-shaped range identically, since the endpoint unions them", () => {
    const today = new Date();
    const dayA = new Date(today.getFullYear(), today.getMonth(), 2);
    const dayB = new Date(today.getFullYear(), today.getMonth(), 3);

    render(
      <AvailabilityCalendar
        reservedRanges={[
          { start_date: toDateOnlyISO(dayA), end_date: toDateOnlyISO(dayA) },
          { start_date: toDateOnlyISO(dayB), end_date: toDateOnlyISO(dayB) },
        ]}
        loading={false}
      />
    );

    const buttonA = screen.getByRole("button", { name: String(dayA.getDate()) });
    const buttonB = screen.getByRole("button", { name: String(dayB.getDate()) });
    expect(buttonA).toBeDisabled();
    expect(buttonB).toBeDisabled();
    expect(buttonA.className).toBe(buttonB.className);
  });
});

describe("AvailabilityCalendar month navigation (HUC-03 S2, RB-4)", () => {
  const monthsAhead = (n: number, day = 1) => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + n, day);
  };
  const monthName = (d: Date) => new Intl.DateTimeFormat("es", { month: "long" }).format(d);
  const dayButton = (d: Date) => screen.getByRole("button", { name: String(d.getDate()) });

  it("shows a range that lives in the next month only after navigating forward", () => {
    const occupied = monthsAhead(1, 12);
    const iso = toDateOnlyISO(occupied);

    render(
      <AvailabilityCalendar reservedRanges={[{ start_date: iso, end_date: iso }]} loading={false} />
    );

    // Current month: day 12 is NOT part of the range.
    expect(dayButton(occupied)).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(dayButton(occupied)).toBeDisabled();
    expect(screen.getByText(new RegExp(monthName(occupied), "i"))).toBeInTheDocument();
  });

  it("marks a range two months ahead after navigating twice, and not one month ahead", () => {
    const occupied = monthsAhead(2, 20);
    const iso = toDateOnlyISO(occupied);

    render(
      <AvailabilityCalendar reservedRanges={[{ start_date: iso, end_date: iso }]} loading={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(dayButton(occupied)).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(dayButton(occupied)).toBeDisabled();
  });

  it("marks the tail of a range that crosses a month boundary in both months", () => {
    const start = monthsAhead(0, 28);
    const end = monthsAhead(1, 2);

    render(
      <AvailabilityCalendar
        reservedRanges={[{ start_date: toDateOnlyISO(start), end_date: toDateOnlyISO(end) }]}
        loading={false}
      />
    );

    expect(dayButton(start)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(dayButton(end)).toBeDisabled();
  });

  it("does not render the previous-month button at the current month, and renders it after going forward", () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={false} />);

    expect(screen.queryByRole("button", { name: "Mes anterior" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    expect(screen.queryByRole("button", { name: "Mes anterior" })).not.toBeInTheDocument();
  });

  it("stops offering the next-month button after 24 months ahead", () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={false} />);

    for (let i = 0; i < 24; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    }

    expect(screen.queryByRole("button", { name: "Mes siguiente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mes anterior" })).toBeInTheDocument();
  });

  it("never disables the navigation buttons, even when the visible month is fully occupied", () => {
    const first = monthsAhead(1, 1);
    const last = monthsAhead(2, 0);

    render(
      <AvailabilityCalendar
        reservedRanges={[{ start_date: toDateOnlyISO(first), end_date: toDateOnlyISO(last) }]}
        loading={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(screen.getByRole("button", { name: "Mes siguiente" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Mes anterior" })).not.toBeDisabled();
    expect(dayButton(first)).toBeDisabled();
  });

  it('shows the "Ocupada" legend entry', () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={false} />);

    expect(screen.getByText("Ocupada")).toBeInTheDocument();
  });

  it("renders no navigation or legend while loading", () => {
    render(<AvailabilityCalendar reservedRanges={[]} loading={true} />);

    expect(screen.queryByRole("button", { name: "Mes siguiente" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ocupada")).not.toBeInTheDocument();
  });
});
