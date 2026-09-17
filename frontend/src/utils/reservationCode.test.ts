import { describe, it, expect } from "vitest";
import { formatReservationCode } from "./reservationCode";

describe("formatReservationCode", () => {
  // Mirrored fixtures against the backend's canonical twin
  // `backend/app/Support/ReservationCode.php::format()`. Both implementations
  // MUST stay byte-identical for the same input id — there is no shared
  // cross-runtime module, so these fixtures are the drift guard.
  it("formats id 42 as LEO-000042", () => {
    expect(formatReservationCode(42)).toBe("LEO-000042");
  });

  it("formats id 204815 as LEO-204815", () => {
    expect(formatReservationCode(204815)).toBe("LEO-204815");
  });

  it("formats id 1 as LEO-000001", () => {
    expect(formatReservationCode(1)).toBe("LEO-000001");
  });
});
