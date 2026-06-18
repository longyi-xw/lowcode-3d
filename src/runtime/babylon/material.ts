import { Color3, PBRMaterial, type Scene } from "@babylonjs/core";

import type { ResolvedMaterial } from "@/core/scene/material";

/** Full-set a Babylon PBRMaterial from a resolved (default ⊕ override)
 *  descriptor. Every field is set unconditionally so clearing an override
 *  resets to default (mirrors three/node-builders/mesh.applyResolvedMaterial). */
export function applyPbrMaterial(mat: PBRMaterial, m: ResolvedMaterial): void {
  mat.albedoColor = Color3.FromHexString(m.color);
  mat.metallic = m.metalness;
  mat.roughness = m.roughness;
  mat.emissiveColor = Color3.FromHexString(m.emissive);
  mat.emissiveIntensity = m.emissive_intensity;
  mat.alpha = m.opacity;
  mat.transparencyMode =
    m.opacity < 1 ? PBRMaterial.MATERIAL_ALPHABLEND : PBRMaterial.MATERIAL_OPAQUE;
}

export function createPbrMaterial(name: string, scene: Scene): PBRMaterial {
  return new PBRMaterial(`${name}-mat`, scene);
}
