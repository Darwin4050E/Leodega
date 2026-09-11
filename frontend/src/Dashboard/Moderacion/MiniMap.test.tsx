import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock("leaflet", () => ({
  default: { Icon: class {} },
}));

import MiniMap from "./MiniMap";

describe("MiniMap", () => {
  it("renders the map when both coordinates are present", () => {
    const { getByTestId } = render(<MiniMap latitude={-2.118} longitude={-79.955} />);
    expect(getByTestId("map-container")).toBeInTheDocument();
  });

  it("renders nothing when latitude is null", () => {
    const { container } = render(<MiniMap latitude={null} longitude={-79.955} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when longitude is null", () => {
    const { container } = render(<MiniMap latitude={-2.118} longitude={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when both coordinates are null", () => {
    const { container } = render(<MiniMap latitude={null} longitude={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
