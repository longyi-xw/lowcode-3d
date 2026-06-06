import { describe, expect, it } from "vitest";

import { SNAP_PIXELS, snapToNodes, type SnapPoint } from "./nodes";

describe("snapToNodes", () => {
  it("returns the world offset to align the nearest in-threshold pair", () => {
    const dragged: SnapPoint[] = [{ screen: [100, 100], world: [0, 0, 0] }];
    const targets: SnapPoint[] = [{ screen: [105, 103], world: [1, 2, 3] }];
    // screen dist hypot(5,3) ≈ 5.83 < 12 → align dragged(0,0,0) to target(1,2,3)
    expect(snapToNodes(dragged, targets, 12)).toEqual([1, 2, 3]);
  });

  it("returns null when no pair is within the pixel threshold", () => {
    const dragged: SnapPoint[] = [{ screen: [0, 0], world: [0, 0, 0] }];
    const targets: SnapPoint[] = [{ screen: [200, 200], world: [1, 1, 1] }];
    expect(snapToNodes(dragged, targets, 12)).toBeNull();
  });

  it("returns null for empty targets", () => {
    const dragged: SnapPoint[] = [{ screen: [0, 0], world: [0, 0, 0] }];
    expect(snapToNodes(dragged, [], 12)).toBeNull();
  });

  it("picks the screen-closest pair among several", () => {
    const dragged: SnapPoint[] = [{ screen: [100, 100], world: [0, 0, 0] }];
    const targets: SnapPoint[] = [
      { screen: [108, 100], world: [9, 9, 9] }, // dist 8
      { screen: [102, 100], world: [5, 0, 0] }, // dist 2 — closest
    ];
    expect(snapToNodes(dragged, targets, 12)).toEqual([5, 0, 0]);
  });

  it("defaults to SNAP_PIXELS (12)", () => {
    expect(SNAP_PIXELS).toBe(12);
  });
});
