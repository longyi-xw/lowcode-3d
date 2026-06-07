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

  it("among in-threshold pairs, picks the one closest in 3D world space", () => {
    // Both targets are within the pixel threshold on screen, but one is much
    // farther in depth. The screen-nearest must NOT win — pick the 3D-nearest
    // so a parallel/side view doesn't snap to a far box behind a near one.
    const dragged: SnapPoint[] = [{ screen: [100, 100], world: [0, 0, 0] }];
    const targets: SnapPoint[] = [
      { screen: [102, 100], world: [0, 0, 10] }, // screen-near (2px) but far in 3D (10)
      { screen: [108, 100], world: [0, 0, 1] }, // screen 8px (<12) but near in 3D (1)
    ];
    expect(snapToNodes(dragged, targets, 12)).toEqual([0, 0, 1]);
  });

  it("defaults to SNAP_PIXELS (12)", () => {
    expect(SNAP_PIXELS).toBe(12);
  });
});
