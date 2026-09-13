import { describe, it, expect } from "vitest";
import { toDateOnlyISO, isDateBetween } from "./dates";

describe("toDateOnlyISO", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(toDateOnlyISO(new Date(2030, 0, 5))).toBe("2030-01-05");
  });

  it("pads single-digit month and day", () => {
    expect(toDateOnlyISO(new Date(2030, 8, 9))).toBe("2030-09-09");
  });
});

describe("isDateBetween", () => {
  it("returns true when target is inside the range (inclusive bounds)", () => {
    expect(isDateBetween("2030-01-10", "2030-01-10", "2030-01-20")).toBe(true);
    expect(isDateBetween("2030-01-20", "2030-01-10", "2030-01-20")).toBe(true);
    expect(isDateBetween("2030-01-15", "2030-01-10", "2030-01-20")).toBe(true);
  });

  it("returns false when target is outside the range", () => {
    expect(isDateBetween("2030-01-09", "2030-01-10", "2030-01-20")).toBe(false);
    expect(isDateBetween("2030-01-21", "2030-01-10", "2030-01-20")).toBe(false);
  });
});
