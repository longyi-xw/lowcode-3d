import { describe, expect, it } from "vitest";
import { NullEngine, Scene, MeshBuilder, Vector3 } from "@babylonjs/core";
import { computeBabylonFocusTarget } from "./focus-helpers";

function scene() {
  return new Scene(new NullEngine());
}

describe("computeBabylonFocusTarget", () => {
  it("null node → origin at default distance 5", () => {
    const r = computeBabylonFocusTarget(null);
    expect(r.target.equals(Vector3.Zero())).toBe(true);
    expect(r.distance).toBeCloseTo(5);
  });

  it("centers on a node's bbox; distance = max(size)*2 clamped to 0.2", () => {
    const s = scene();
    const box = MeshBuilder.CreateBox("b", { size: 2 }, s);
    box.position.set(10, 0, 0);
    box.computeWorldMatrix(true);
    const r = computeBabylonFocusTarget(box);
    expect(r.target.x).toBeCloseTo(10);
    expect(r.distance).toBeCloseTo(4); // size 2 → max 2 → *2 = 4
    s.getEngine().dispose();
  });
});
