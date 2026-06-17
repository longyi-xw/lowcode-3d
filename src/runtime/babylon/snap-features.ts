import {
  Matrix,
  Vector3,
  Viewport,
  type AbstractMesh,
  type Node as BabylonNode,
  type Scene,
} from "@babylonjs/core";

import type { SnapPoint } from "@/core/snap/nodes";
import type { SocketPoint } from "@/core/snap/sockets";
import type { Socket } from "@/core/scene/types";

/** Descendant meshes of a node, including the node itself when it is a mesh. */
function meshesOf(node: BabylonNode): AbstractMesh[] {
  const children = node.getChildMeshes(false);
  const self = node as unknown as Partial<AbstractMesh>;
  if (typeof self.getBoundingInfo === "function") {
    return [self as unknown as AbstractMesh, ...children.filter((m) => m !== self)];
  }
  return children;
}

/** 15 OBB features (center + 8 corners + 6 face centers) in WORLD space; []
 *  when the node has no mesh geometry. Mirrors three/snap-features.bboxFeatures:
 *  accumulate each descendant mesh's local box into the dragged node's local
 *  space, then transform the 15 local points by the node world matrix so they
 *  follow rotation (OBB, not world AABB). Index order MUST match the Three
 *  version for cross-engine node-align parity. */
export function bboxFeatures(node: BabylonNode): Vector3[] {
  const tn = node as BabylonNode & { computeWorldMatrix?: (force: boolean) => Matrix };
  if (typeof tn.computeWorldMatrix !== "function") return [];
  tn.computeWorldMatrix(true);
  const world = tn.getWorldMatrix();
  const invWorld = Matrix.Invert(world);
  let min: Vector3 | null = null;
  let max: Vector3 | null = null;

  const expand = (p: Vector3) => {
    if (!min || !max) {
      min = p.clone();
      max = p.clone();
    } else {
      min = Vector3.Minimize(min, p);
      max = Vector3.Maximize(max, p);
    }
  };

  for (const mesh of meshesOf(node)) {
    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    // mesh-local → node-local = meshWorld · invNodeWorld (Babylon row-vector convention)
    const rel = mesh.getWorldMatrix().multiply(invWorld);
    const lo = bb.minimum;
    const hi = bb.maximum;
    for (const x of [lo.x, hi.x])
      for (const y of [lo.y, hi.y])
        for (const z of [lo.z, hi.z])
          expand(Vector3.TransformCoordinates(new Vector3(x, y, z), rel));
  }

  if (!min || !max) return [];
  const lmin: Vector3 = min;
  const lmax: Vector3 = max;
  const c = Vector3.Center(lmin, lmax);

  // Same index order as Three version: center, 8 corners, 6 face centers.
  const local: Vector3[] = [
    c,
    new Vector3(lmin.x, lmin.y, lmin.z),
    new Vector3(lmin.x, lmin.y, lmax.z),
    new Vector3(lmin.x, lmax.y, lmin.z),
    new Vector3(lmin.x, lmax.y, lmax.z),
    new Vector3(lmax.x, lmin.y, lmin.z),
    new Vector3(lmax.x, lmin.y, lmax.z),
    new Vector3(lmax.x, lmax.y, lmin.z),
    new Vector3(lmax.x, lmax.y, lmax.z),
    // 6 face centers (index 9–14): +X, -X, +Y, -Y, +Z, -Z
    new Vector3(lmax.x, c.y, c.z),
    new Vector3(lmin.x, c.y, c.z),
    new Vector3(c.x, lmax.y, c.z),
    new Vector3(c.x, lmin.y, c.z),
    new Vector3(c.x, c.y, lmax.z),
    new Vector3(c.x, c.y, lmin.z),
  ];

  return local.map((p) => Vector3.TransformCoordinates(p, world));
}

/** World point → screen pixels. Caller ensures scene transform matrix is
 *  current (render loop updates it; tests call scene.updateTransformMatrix). */
export function toScreen(
  v: Vector3,
  scene: Scene,
  w: number,
  h: number,
): [number, number] {
  const p = Vector3.Project(
    v,
    Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    new Viewport(0, 0, w, h),
  );
  return [p.x, p.y];
}

/** A node's bbox features → SnapPoint[] (screen + world). */
export function featureSnapPoints(
  node: BabylonNode,
  scene: Scene,
  w: number,
  h: number,
): SnapPoint[] {
  return bboxFeatures(node).map((v) => ({
    screen: toScreen(v, scene, w, h),
    world: [v.x, v.y, v.z] as [number, number, number],
  }));
}

/** A node + its sockets → SocketPoint[] (world point via node world matrix, with tag). */
export function socketPoints(
  node: BabylonNode,
  sockets: readonly Socket[],
  scene: Scene,
  w: number,
  h: number,
): SocketPoint[] {
  if (sockets.length === 0) return [];
  const tn = node as BabylonNode & { computeWorldMatrix?: (force: boolean) => Matrix };
  if (typeof tn.computeWorldMatrix === "function") tn.computeWorldMatrix(true);
  const world = tn.getWorldMatrix();
  return sockets.map((s) => {
    const wp = Vector3.TransformCoordinates(
      new Vector3(s.position[0], s.position[1], s.position[2]),
      world,
    );
    return {
      screen: toScreen(wp, scene, w, h),
      world: [wp.x, wp.y, wp.z] as [number, number, number],
      tag: s.tag ?? "",
    };
  });
}
