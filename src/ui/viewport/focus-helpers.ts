import * as THREE from "three";

const MIN_DISTANCE = 0.2;
const DEFAULT_DISTANCE = 5;

/**
 * Compute the OrbitControls target + camera distance for an "F key"
 * focus action.
 *
 * obj === null → focus origin at default distance (used when no
 *                node is selected).
 * obj !== null → center on the object's world bounding box and put
 *                camera at distance = max(size) * 2 (clamped to
 *                MIN_DISTANCE so tiny / empty objects still work).
 */
export function computeFocusTarget(obj: THREE.Object3D | null): {
  target: THREE.Vector3;
  distance: number;
} {
  if (!obj) {
    return { target: new THREE.Vector3(0, 0, 0), distance: DEFAULT_DISTANCE };
  }
  const box = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSize = Math.max(size.x, size.y, size.z, 0);
  const distance = Math.max(maxSize * 2, MIN_DISTANCE);
  return { target: center, distance };
}
