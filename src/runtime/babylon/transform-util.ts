import { Quaternion, Vector3, type Node as BabylonNode } from "@babylonjs/core";

import type { Transform } from "@/core/scene/types";

/** Snapshot a Babylon node's transform. Gizmo rotation writes
 *  rotationQuaternion, but a node that has never been rotated may still carry a
 *  null rotationQuaternion + Euler rotation — fall back to converting that so a
 *  rotate-drag commit captures the real start/end. */
export function captureTransform(node: BabylonNode): Transform {
  const t = node as BabylonNode & {
    position?: Vector3;
    rotationQuaternion?: Quaternion | null;
    rotation?: Vector3;
    scaling?: Vector3;
  };
  const pos = t.position ?? Vector3.Zero();
  const q =
    t.rotationQuaternion ??
    (t.rotation ? Quaternion.FromEulerVector(t.rotation) : null);
  const scl = t.scaling ?? new Vector3(1, 1, 1);
  return {
    position: [pos.x, pos.y, pos.z],
    rotation: q ? [q.x, q.y, q.z, q.w] : [0, 0, 0, 1],
    scale: [scl.x, scl.y, scl.z],
  };
}
