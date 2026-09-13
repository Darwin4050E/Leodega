import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
