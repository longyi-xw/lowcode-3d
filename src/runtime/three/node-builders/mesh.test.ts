import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { DEFAULT_MESH_MATERIAL } from "@/core/scene/material";
import type { SceneNode } from "@/core/scene/types";

import { build, update } from "./mesh";

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

function meshWithMaterial(override?: {
  slot: number;
  color?: string;
  opacity?: number;
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
    data: {
      type: "mesh",
      geometry: { kind: "box" },
      material_overrides: override ? [override] : undefined,
    },
    behaviors: [],
    user_data: {},
  };
}

describe("mesh builder material", () => {
  it("applies the default material when there is no override", () => {
    const mesh = build(meshWithMaterial()) as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(`#${mat.color.getHexString()}`).toBe(DEFAULT_MESH_MATERIAL.color);
    expect(mat.metalness).toBe(DEFAULT_MESH_MATERIAL.metalness);
    expect(mat.roughness).toBe(DEFAULT_MESH_MATERIAL.roughness);
  });

  it("applies override fields and sets transparent when opacity < 1", () => {
    const mesh = build(
      meshWithMaterial({ slot: 0, color: "#ff0000", opacity: 0.5 }),
    ) as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(`#${mat.color.getHexString()}`).toBe("#ff0000");
    expect(mat.opacity).toBe(0.5);
    expect(mat.transparent).toBe(true);
  });

  it("resets material back to default when override is removed (update)", () => {
    const mesh = build(meshWithMaterial({ slot: 0, color: "#ff0000" })) as THREE.Mesh;
    update(mesh, meshWithMaterial()); // no override now
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(`#${mat.color.getHexString()}`).toBe(DEFAULT_MESH_MATERIAL.color);
  });

  it("turns transparent on via update when opacity drops below 1", () => {
    const mesh = build(meshWithMaterial()) as THREE.Mesh; // opaque default
    expect((mesh.material as THREE.MeshStandardMaterial).transparent).toBe(false);
    update(mesh, meshWithMaterial({ slot: 0, opacity: 0.5 }));
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0.5);
  });
});
