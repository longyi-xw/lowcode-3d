import { describe, expect, it } from "vitest";

import { isEffectivelyLocked } from "./policy";
import type { SceneNode } from "./types";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function node(
  overrides: Partial<SceneNode> & Pick<SceneNode, "type" | "data">,
): SceneNode {
  return {
    id: "n",
    name: "n",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    behaviors: [],
    user_data: {},
    ...overrides,
  };
}

describe("isEffectivelyLocked", () => {
  it("returns true for helpers regardless of the stored locked field", () => {
    const grid = node({
      type: "helper",
      data: { type: "helper", helper_kind: "grid" },
      locked: false,
    });
    expect(isEffectivelyLocked(grid)).toBe(true);
  });

  it("still returns true for helpers explicitly locked on disk", () => {
    const grid = node({
      type: "helper",
      data: { type: "helper", helper_kind: "grid" },
      locked: true,
    });
    expect(isEffectivelyLocked(grid)).toBe(true);
  });

  it("returns the stored value for mesh / light / camera / group", () => {
    const cube = node({
      type: "mesh",
      data: { type: "mesh", asset_id: "a" },
      locked: false,
    });
    expect(isEffectivelyLocked(cube)).toBe(false);

    const lockedCube = node({
      type: "mesh",
      data: { type: "mesh", asset_id: "a" },
      locked: true,
    });
    expect(isEffectivelyLocked(lockedCube)).toBe(true);

    const group = node({ type: "group", data: { type: "group" }, locked: false });
    expect(isEffectivelyLocked(group)).toBe(false);
  });
});
