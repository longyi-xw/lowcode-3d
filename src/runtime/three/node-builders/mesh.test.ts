import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";

import { build } from "./mesh";

function meshNode(geometry?: {
  kind: "box" | "sphere" | "plane" | "cylinder";
}): SceneNode {
  return {
    id: "m",
    name: "M",
    type: "mesh",
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: geometry ? { type: "mesh", geometry } : { type: "mesh", asset_id: "a" },
    behaviors: [],
    user_data: {},
  };
}

describe("mesh builder geometry", () => {
  it.each([
    ["box", THREE.BoxGeometry],
    ["sphere", THREE.SphereGeometry],
    ["plane", THREE.PlaneGeometry],
    ["cylinder", THREE.CylinderGeometry],
  ] as const)("builds %s geometry", (kind, Ctor) => {
    const obj = build(meshNode({ kind })) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(Ctor);
  });

  it("defaults a legacy mesh (no geometry descriptor) to a box", () => {
    const obj = build(meshNode()) as THREE.Mesh;
    expect(obj.geometry).toBeInstanceOf(THREE.BoxGeometry);
  });
});
