import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type MeshData = Extract<NodeData, { type: "mesh" }>;
type MaterialOverride = NonNullable<MeshData["material_overrides"]>[number];
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
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0,
    roughness: 0.7,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = node.name;
  mesh.userData.assetId = data.asset_id;
  mesh.userData.geometryKind = kind;
  applyOverrides(material, data.material_overrides?.[0]);
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
    applyOverrides(object.material, data.material_overrides?.[0]);
  }
}

function applyOverrides(
  material: THREE.MeshStandardMaterial,
  override: MaterialOverride | undefined,
): void {
  if (!override) return;
  if (override.color) material.color.set(override.color);
  if (override.metalness !== undefined) material.metalness = override.metalness;
  if (override.roughness !== undefined) material.roughness = override.roughness;
  if (override.opacity !== undefined) {
    material.opacity = override.opacity;
    material.transparent = override.opacity < 1;
  }
  if (override.emissive) material.emissive.set(override.emissive);
  if (override.emissive_intensity !== undefined) {
    material.emissiveIntensity = override.emissive_intensity;
  }
}
