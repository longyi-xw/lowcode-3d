import { Vector3, type Node as BabylonNode } from "@babylonjs/core";

const MIN_DISTANCE = 0.2;
const DEFAULT_DISTANCE = 5;

/** Babylon counterpart of viewport/focus-helpers.computeFocusTarget: null →
 *  origin at default distance; else center on the node's world bounding box
 *  with distance = max(size)*2 clamped to MIN_DISTANCE. */
export function computeBabylonFocusTarget(node: BabylonNode | null): {
  target: Vector3;
  distance: number;
} {
  if (!node) return { target: Vector3.Zero(), distance: DEFAULT_DISTANCE };
  const tn = node as BabylonNode & {
    getHierarchyBoundingVectors?: () => { min: Vector3; max: Vector3 };
  };
  if (typeof tn.getHierarchyBoundingVectors !== "function") {
    return { target: Vector3.Zero(), distance: DEFAULT_DISTANCE };
  }
  const { min, max } = tn.getHierarchyBoundingVectors();
  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);
  const maxSize = Math.max(size.x, size.y, size.z, 0);
  return { target: center, distance: Math.max(maxSize * 2, MIN_DISTANCE) };
}
