import { describe, expect, it } from "vitest";

import { SNAP_STEP, snapTranslation } from "./grid";

describe("snapTranslation", () => {
  it("snaps each axis to the nearest 0.5 step", () => {
    expect(snapTranslation([0.3, 0.7, -0.4], 0.5)).toEqual([0.5, 0.5, -0.5]);
  });

  it("leaves exact grid points unchanged", () => {
    expect(snapTranslation([1, -2, 0], 0.5)).toEqual([1, -2, 0]);
  });

  it("is symmetric for negatives", () => {
    expect(snapTranslation([-0.8, 0.8, 0], 0.5)).toEqual([-1, 1, 0]);
  });

  it("returns the position unchanged for step <= 0", () => {
    expect(snapTranslation([0.3, 0.7, -0.4], 0)).toEqual([0.3, 0.7, -0.4]);
  });

  it("defaults to SNAP_STEP (0.5)", () => {
    expect(SNAP_STEP).toBe(0.5);
    expect(snapTranslation([0.24, 0.26, 0])).toEqual([0, 0.5, 0]);
  });
});
