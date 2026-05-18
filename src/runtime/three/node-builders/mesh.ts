import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type MeshData = Extract<NodeData, { type: "mesh" }>;
type MaterialOverride = NonNullable<MeshData["material_overrides"]>[number];

function requireMeshData(node: SceneNode): MeshData {
  if (node.data.type !== "mesh") {
    throw new Error(`mesh builder received node of type ${node.data.type}`);
  }
  return node.data;
}

/**
 * Builds a placeholder cube for now — `syncAsset` will swap the geometry once
 * .glb loading lands. The placeholder lets the editor render *something* before
 * assets exist, which is the right MVP behavior for hand-authored scenes.
 */
export function build(node: SceneNode): THREE.Object3D {
  const data = requireMeshData(node);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0,
    roughness: 0.7,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = node.name;
  mesh.userData.assetId = data.asset_id;
  applyOverrides(material, data.material_overrides?.[0]);
  return mesh;
}

export function update(object: THREE.Object3D, node: SceneNode): void {
  const data = requireMeshData(node);
  if (!(object instanceof THREE.Mesh)) return;
  object.userData.assetId = data.asset_id;
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
