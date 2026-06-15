import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { Transform } from "@/core/scene/types";
import { captureTransform, transformsEqual } from "./transform-util";

describe("captureTransform", () => {
  it("snapshots position/quaternion/scale arrays", () => {
    const o = new THREE.Object3D();
    o.position.set(1, 2, 3);
    o.scale.set(2, 2, 2);
    const t = captureTransform(o);
    expect(t.position).toEqual([1, 2, 3]);
    expect(t.scale).toEqual([2, 2, 2]);
    expect(t.rotation).toHaveLength(4);
  });
});

describe("transformsEqual", () => {
  it("true for identical, false for any differing component", () => {
    const a: Transform = {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
    expect(transformsEqual(a, { ...a })).toBe(true);
    expect(transformsEqual(a, { ...a, position: [0, 1, 0] })).toBe(false);
  });
});
