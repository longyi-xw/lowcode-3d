import * as THREE from "three";

import type { SnapPoint } from "@/core/snap/nodes";
import type { SocketPoint } from "@/core/snap/sockets";
import type { Socket } from "@/core/scene/types";

/** 15 个 bbox 特征（中心 + 8 角 + 6 面中心）的世界坐标；无几何返回 []。
 *  面中心让"球放到 box 顶面/侧面"这类面对面对齐也能吸附。
 *
 *  用 **有向包围盒（OBB）**：在 obj 的局部空间算 bbox（遍历子 mesh 的几何
 *  boundingBox，经"相对 obj"的矩阵 union），再把 15 个局部特征点整体经
 *  `obj.matrixWorld` 变换到世界。这样角/面中心会跟随物体旋转——而 `Box3.
 *  setFromObject` 给的是轴对齐世界 AABB，旋转后的 box 其 AABB 顶面中心并不在
 *  它真正的顶面上，导致"球吸到旋转 box 顶部"困难。 */
export function bboxFeatures(obj: THREE.Object3D): THREE.Vector3[] {
  obj.updateWorldMatrix(true, true);
  const local = new THREE.Box3();
  const invWorld = obj.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const tmp = new THREE.Box3();
  let found = false;
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!mesh.isMesh || !geom) return;
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (!geom.boundingBox) return;
    // child 相对 obj 的变换 = obj.matrixWorld⁻¹ · child.matrixWorld
    rel.multiplyMatrices(invWorld, child.matrixWorld);
    tmp.copy(geom.boundingBox).applyMatrix4(rel);
    local.union(tmp);
    found = true;
  });
  if (!found || local.isEmpty()) return [];
  const c = new THREE.Vector3();
  local.getCenter(c);
  const { min, max } = local;
  const pts = [
    c,
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
    // 6 face centers — so "ball on a box's top/side" (face-to-face) snaps too.
    new THREE.Vector3(max.x, c.y, c.z),
    new THREE.Vector3(min.x, c.y, c.z),
    new THREE.Vector3(c.x, max.y, c.z),
    new THREE.Vector3(c.x, min.y, c.z),
    new THREE.Vector3(c.x, c.y, max.z),
    new THREE.Vector3(c.x, c.y, min.z),
  ];
  // 局部特征点 → 世界（含 obj 的旋转/缩放/平移）。
  return pts.map((p) => p.applyMatrix4(obj.matrixWorld));
}

/** 世界坐标 → 屏幕像素（用 canvas 尺寸）。 */
export function toScreen(
  v: THREE.Vector3,
  camera: THREE.Camera,
  w: number,
  h: number,
): [number, number] {
  const ndc = v.clone().project(camera);
  return [((ndc.x + 1) / 2) * w, ((1 - ndc.y) / 2) * h];
}

/** 一个 Object3D 的 bbox 特征 → SnapPoint[]（屏幕 + 世界）。 */
export function featureSnapPoints(
  obj: THREE.Object3D,
  camera: THREE.Camera,
  w: number,
  h: number,
): SnapPoint[] {
  return bboxFeatures(obj).map((v) => ({
    screen: toScreen(v, camera, w, h),
    world: [v.x, v.y, v.z] as [number, number, number],
  }));
}

/** 一个节点 + 它的 sockets → SocketPoint[]（世界点经 node.matrixWorld，附 tag）。 */
export function socketPoints(
  obj: THREE.Object3D,
  sockets: readonly Socket[],
  camera: THREE.Camera,
  w: number,
  h: number,
): SocketPoint[] {
  if (sockets.length === 0) return [];
  obj.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  return sockets.map((s) => {
    v.set(s.position[0], s.position[1], s.position[2]).applyMatrix4(obj.matrixWorld);
    return {
      screen: toScreen(v, camera, w, h),
      world: [v.x, v.y, v.z] as [number, number, number],
      tag: s.tag,
    };
  });
}
