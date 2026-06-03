import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";

import { build, update } from "./light";

function lightNode(
  light_kind: "directional" | "point" | "spot" | "ambient",
  color = "#ffffff",
): SceneNode {
  return {
    id: "l",
    name: "L",
    type: "light",
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "light", light_kind, color, intensity: 1 },
    behaviors: [],
    user_data: {},
  };
}

function markerOf(light: THREE.Object3D): THREE.Mesh | undefined {
  return light.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
}

describe("light builder viewport marker", () => {
  it.each(["directional", "point", "spot", "ambient"] as const)(
    "%s light gets an unlit, pickable marker child so it's visible in the viewport",
    (kind) => {
      const light = build(lightNode(kind));
      const marker = markerOf(light);
      expect(marker).toBeDefined();
      // Unlit → always visible regardless of scene lighting.
      expect(marker!.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      // Pickable (default raycast, NOT the helper noop): clicking the marker
      // walks up to the light's nodeId and selects it.
      expect(marker!.raycast).toBe(THREE.Mesh.prototype.raycast);
    },
  );

  it("marker uses the light color and tracks color updates", () => {
    const light = build(lightNode("point", "#ff0000"));
    const mat = markerOf(light)!.material as THREE.MeshBasicMaterial;
    expect(mat.color.getHexString()).toBe("ff0000");
    update(light, lightNode("point", "#00ff00"));
    expect(mat.color.getHexString()).toBe("00ff00");
  });
});
