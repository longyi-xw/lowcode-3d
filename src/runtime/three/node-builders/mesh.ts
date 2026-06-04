import * as THREE from "three";

import { resolveMaterial, type ResolvedMaterial } from "@/core/scene/material";
import type { NodeData, SceneNode } from "@/core/scene/types";

type MeshData = Extract<NodeData, { type: "mesh" }>;
type GeometryKind = NonNullable<MeshData["geometry"]>["kind"];

function requireMeshData(node: SceneNode): MeshData {
  if (node.data.type !== "mesh") {
    throw new Error(`mesh builder received node of type ${node.data.type}`);
  }
  return node.data;
}

/**
 * Pure mapping from a primitive kind to a fresh THREE geometry (unit-ish sizes
 * centered at the origin). Legacy mesh nodes without a geometry descriptor pass
 * "box" here — see {@link build}. `asset_id`-backed meshes still get a box for
 * now; `syncAsset` swaps in real glTF geometry once it loads.
 */
function geometryFor(kind: GeometryKind): THREE.BufferGeometry {
  switch (kind) {
    case "sphere":
      return new THREE.SphereGeometry(0.5, 32, 16);
    case "plane":
      return new THREE.PlaneGeometry(1, 1);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    case "box":
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export function build(node: SceneNode): THREE.Object3D {
  const data = requireMeshData(node);
  const kind = data.geometry?.kind ?? "box";
  const geometry = geometryFor(kind);
  const material = new THREE.MeshStandardMaterial();
  applyResolvedMaterial(material, resolveMaterial(data.material_overrides?.[0]));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = node.name;
  mesh.userData.assetId = data.asset_id;
  mesh.userData.geometryKind = kind;
  return mesh;
}

export function update(object: THREE.Object3D, node: SceneNode): void {
  const data = requireMeshData(node);
  if (!(object instanceof THREE.Mesh)) return;
  object.userData.assetId = data.asset_id;
  const kind = data.geometry?.kind ?? "box";
  if (object.userData.geometryKind !== kind) {
    object.geometry.dispose();
    object.geometry = geometryFor(kind);
    object.userData.geometryKind = kind;
  }
  if (object.material instanceof THREE.MeshStandardMaterial) {
    applyResolvedMaterial(
      object.material,
      resolveMaterial(data.material_overrides?.[0]),
    );
  }
}

/** Full-set a material from a resolved (default ⊕ override) descriptor. Sets
 *  every field unconditionally so clearing an override resets to default
 *  (an if-set-only pass would leave stale values behind). */
function applyResolvedMaterial(
  material: THREE.MeshStandardMaterial,
  m: ResolvedMaterial,
): void {
  material.color.set(m.color);
  material.metalness = m.metalness;
  material.roughness = m.roughness;
  material.emissive.set(m.emissive);
  material.emissiveIntensity = m.emissive_intensity;
  material.opacity = m.opacity;
  const transparent = m.opacity < 1;
  if (material.transparent !== transparent) {
    // Toggling `transparent` switches the render pipeline — without a shader
    // recompile the new opacity is ignored (mesh stays fully opaque).
    material.transparent = transparent;
    material.needsUpdate = true;
  }
}
