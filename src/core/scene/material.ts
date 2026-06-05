import type { NodeData } from "./types";

export type MaterialOverride = NonNullable<
  Extract<NodeData, { type: "mesh" }>["material_overrides"]
>[number];

export interface ResolvedMaterial {
  color: string; // hex #rrggbb
  metalness: number;
  roughness: number;
  emissive: string; // hex #rrggbb
  emissive_intensity: number;
  opacity: number;
}

/** Single source of truth for a mesh's default material — previously hard-coded
 *  in mesh.ts (builder) and emitMesh (codegen). */
export const DEFAULT_MESH_MATERIAL: ResolvedMaterial = {
  color: "#cccccc",
  metalness: 0,
  roughness: 0.7,
  emissive: "#000000",
  emissive_intensity: 1,
  opacity: 1,
};

/** Default ⊕ override → fully-resolved material. Used by the panel (display),
 *  the runtime builder (render) and codegen (export) so all three agree.
 *  Per-field `??` (not spread) because optional override fields are
 *  `undefined` and would otherwise clobber the defaults. */
export function resolveMaterial(override?: MaterialOverride): ResolvedMaterial {
  return {
    color: override?.color ?? DEFAULT_MESH_MATERIAL.color,
    metalness: override?.metalness ?? DEFAULT_MESH_MATERIAL.metalness,
    roughness: override?.roughness ?? DEFAULT_MESH_MATERIAL.roughness,
    emissive: override?.emissive ?? DEFAULT_MESH_MATERIAL.emissive,
    emissive_intensity:
      override?.emissive_intensity ?? DEFAULT_MESH_MATERIAL.emissive_intensity,
    opacity: override?.opacity ?? DEFAULT_MESH_MATERIAL.opacity,
  };
}
