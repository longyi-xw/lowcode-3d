import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { computeFocusTarget } from "./focus-helpers";

describe("computeFocusTarget", () => {
  it("returns origin + default distance when obj is null", () => {
    const r = computeFocusTarget(null);
    expect(r.target.toArray()).toEqual([0, 0, 0]);
    expect(r.distance).toBeGreaterThan(0);
  });

  it("centers on obj bounding box + distance = max(size) * 2", () => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 6),
      new THREE.MeshBasicMaterial(),
    );
    box.position.set(10, 0, 0);
    box.updateMatrixWorld(true);
    const r = computeFocusTarget(box);
    // bounding box center = (10, 0, 0)
    expect(r.target.x).toBeCloseTo(10);
    expect(r.target.y).toBeCloseTo(0);
    expect(r.target.z).toBeCloseTo(0);
    // max size = 6, distance = 6 * 2 = 12
    expect(r.distance).toBeCloseTo(12);
  });

  it("clamps distance to a minimum of 0.2 when bbox is near-zero", () => {
    const point = new THREE.Object3D(); // empty, bbox size = (0,0,0)
    const r = computeFocusTarget(point);
    expect(r.distance).toBeGreaterThanOrEqual(0.2);
  });
});
