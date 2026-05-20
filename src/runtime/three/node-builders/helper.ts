import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type HelperData = Extract<NodeData, { type: "helper" }>;

function requireHelperData(node: SceneNode): HelperData {
  if (node.data.type !== "helper") {
    throw new Error(`helper builder received node of type ${node.data.type}`);
  }
  return node.data;
}

/**
 * Helper nodes are editor-only visual aids — they should not export. The
 * exporter filters them out; here we just render whichever helper kind the
 * SceneNode requests, falling back to an empty Object3D for unknown kinds so
 * the hierarchy stays intact.
 *
 * Helpers are unpickable: their `raycast` is replaced with a no-op so the
 * viewport raycast never selects them and — critically — never lets their
 * geometry intercept a click that should reach a mesh behind them. GridHelper
 * is a `LineSegments` whose default line-proximity raycast would otherwise
 * grab clicks any time the user happens to hit one of the grid lines, which
 * becomes a real problem the moment a helper is moved off origin (it floats
 * in front of geometry). Selection via the hierarchy panel still works
 * because that path doesn't go through raycast.
 */
export function build(node: SceneNode): THREE.Object3D {
  const data = requireHelperData(node);
  const obj = create(data.helper_kind);
  obj.name = node.name;
  obj.traverse((child) => {
    child.raycast = noopRaycast;
  });
  return obj;
}

export function update(_object: THREE.Object3D, _node: SceneNode): void {
  // Helpers are static in MVP; recreating on kind change happens via remove+add.
}

function create(kind: string): THREE.Object3D {
  switch (kind) {
    case "grid":
      return new THREE.GridHelper(10, 10);
    case "axes":
      return new THREE.AxesHelper(1);
    default:
      return new THREE.Object3D();
  }
}

function noopRaycast(): void {
  // No intersections produced — opt the helper subtree out of raycast picks.
}
