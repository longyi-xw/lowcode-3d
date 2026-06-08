import { describe, expect, it } from "vitest";

import { dropPositionFor, screenToNdc } from "./drop-helpers";

describe("screenToNdc", () => {
  it("maps the canvas center to the NDC origin", () => {
    expect(screenToNdc(50, 50, 100, 100)).toEqual([0, 0]);
  });
  it("maps the top-left corner to (-1, 1)", () => {
    expect(screenToNdc(0, 0, 100, 100)).toEqual([-1, 1]);
  });
  it("maps the bottom-right corner to (1, -1)", () => {
    expect(screenToNdc(100, 100, 100, 100)).toEqual([1, -1]);
  });
  it("maps each axis independently for a non-square viewport", () => {
    expect(screenToNdc(100, 75, 200, 100)).toEqual([0, -0.5]);
  });
});

describe("dropPositionFor", () => {
  it("takes x/z from the hit and keeps the default y", () => {
    expect(dropPositionFor([0, 0.5, 0], [3, 0, -2])).toEqual([3, 0.5, -2]);
  });
  it("keeps a light's authored height", () => {
    expect(dropPositionFor([0, 3, 0], [-1.5, 0, 4.2])).toEqual([-1.5, 3, 4.2]);
  });
  it("preserves negative hit coordinates", () => {
    expect(dropPositionFor([0, 1, 0], [-5, 0, -7])).toEqual([-5, 1, -7]);
  });
});
