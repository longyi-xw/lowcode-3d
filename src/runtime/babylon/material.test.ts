import { describe, expect, it } from "vitest";
import { NullEngine, Scene, PBRMaterial } from "@babylonjs/core";
import { applyPbrMaterial, createPbrMaterial } from "./material";
import { DEFAULT_MESH_MATERIAL, resolveMaterial } from "@/core/scene/material";

function scene() {
  return new Scene(new NullEngine());
}

describe("applyPbrMaterial", () => {
  it("maps a resolved override onto PBRMaterial fields", () => {
    const s = scene();
    const mat = createPbrMaterial("m", s);
    applyPbrMaterial(
      mat,
      resolveMaterial({
        slot: 0,
        color: "#3366cc",
        metalness: 0.4,
        roughness: 0.2,
        emissive: "#110022",
        emissive_intensity: 2,
        opacity: 0.5,
      }),
    );
    expect(mat.albedoColor.toHexString().toLowerCase()).toBe("#3366cc");
    expect(mat.metallic).toBeCloseTo(0.4);
    expect(mat.roughness).toBeCloseTo(0.2);
    expect(mat.emissiveColor.toHexString().toLowerCase()).toBe("#110022");
    expect(mat.emissiveIntensity).toBeCloseTo(2);
    expect(mat.alpha).toBeCloseTo(0.5);
    expect(mat.transparencyMode).toBe(PBRMaterial.MATERIAL_ALPHABLEND);
    s.getEngine().dispose();
  });

  it("opacity=1 → OPAQUE; full-set resets to default when override cleared", () => {
    const s = scene();
    const mat = createPbrMaterial("m", s);
    applyPbrMaterial(mat, resolveMaterial({ slot: 0, opacity: 0.3 }));
    expect(mat.transparencyMode).toBe(PBRMaterial.MATERIAL_ALPHABLEND);
    applyPbrMaterial(mat, resolveMaterial(undefined));
    expect(mat.alpha).toBeCloseTo(1);
    expect(mat.transparencyMode).toBe(PBRMaterial.MATERIAL_OPAQUE);
    expect(mat.albedoColor.toHexString().toLowerCase()).toBe(
      DEFAULT_MESH_MATERIAL.color,
    );
    s.getEngine().dispose();
  });
});
