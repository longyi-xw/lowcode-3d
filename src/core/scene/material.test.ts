import { describe, expect, it } from "vitest";

import { DEFAULT_MESH_MATERIAL, resolveMaterial } from "./material";

describe("resolveMaterial", () => {
  it("returns the default material when override is undefined", () => {
    expect(resolveMaterial(undefined)).toEqual(DEFAULT_MESH_MATERIAL);
  });

  it("returns the default material for an override with only a slot", () => {
    expect(resolveMaterial({ slot: 0 })).toEqual(DEFAULT_MESH_MATERIAL);
  });

  it("overrides only the fields present, keeping defaults for the rest", () => {
    const resolved = resolveMaterial({
      slot: 0,
      color: "#ff0000",
      metalness: 0.8,
    });
    expect(resolved.color).toBe("#ff0000");
    expect(resolved.metalness).toBe(0.8);
    // untouched → defaults
    expect(resolved.roughness).toBe(DEFAULT_MESH_MATERIAL.roughness);
    expect(resolved.emissive).toBe(DEFAULT_MESH_MATERIAL.emissive);
    expect(resolved.emissive_intensity).toBe(DEFAULT_MESH_MATERIAL.emissive_intensity);
    expect(resolved.opacity).toBe(DEFAULT_MESH_MATERIAL.opacity);
  });

  it("keeps an explicit 0 (does not fall back to default)", () => {
    // opacity 0 is meaningful — must not be treated as missing
    expect(resolveMaterial({ slot: 0, opacity: 0 }).opacity).toBe(0);
  });
});
