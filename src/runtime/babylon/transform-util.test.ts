import { describe, expect, it } from "vitest";
import { NullEngine, Scene, TransformNode, Vector3, Quaternion } from "@babylonjs/core";
import { captureTransform } from "./transform-util";

function scene() {
  return new Scene(new NullEngine());
}

describe("babylon captureTransform", () => {
  it("reads position/scaling and rotationQuaternion when present", () => {
    const s = scene();
    const n = new TransformNode("n", s);
    n.position.set(1, 2, 3);
    n.scaling.set(2, 2, 2);
    n.rotationQuaternion = new Quaternion(0, 0, 0, 1);
    const t = captureTransform(n);
    expect(t.position).toEqual([1, 2, 3]);
    expect(t.scale).toEqual([2, 2, 2]);
    expect(t.rotation).toEqual([0, 0, 0, 1]);
    s.getEngine().dispose();
  });

  it("falls back to Euler rotation when rotationQuaternion is null", () => {
    const s = scene();
    const n = new TransformNode("n", s);
    n.rotationQuaternion = null;
    n.rotation.set(0, Math.PI / 2, 0);
    const t = captureTransform(n);
    const expected = Quaternion.FromEulerVector(new Vector3(0, Math.PI / 2, 0));
    expect(t.rotation[1]).toBeCloseTo(expected.y, 5);
    expect(t.rotation[3]).toBeCloseTo(expected.w, 5);
    s.getEngine().dispose();
  });
});
