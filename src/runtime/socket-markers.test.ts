import { describe, expect, it } from "vitest";

import { SOCKET_MARKER } from "./socket-markers";

describe("SOCKET_MARKER", () => {
  it("locks the socket-marker visual constants (cross-engine parity)", () => {
    expect(SOCKET_MARKER.radius).toBe(0.06);
    expect(SOCKET_MARKER.color).toBe("#22d3ee");
    expect(SOCKET_MARKER.colorSelected).toBe("#f59e0b");
  });
});
