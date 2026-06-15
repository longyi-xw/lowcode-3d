import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bboxFeatures, computeSnapOffset } from "./snap-features";
import type { SnapPoint } from "@/core/snap/nodes";

describe("bboxFeatures (OBB)", () => {
  it("returns 15 world features for a unit box mesh", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    const pts = bboxFeatures(mesh);
    expect(pts).toHaveLength(15);
    expect(pts[0]!.x).toBeCloseTo(0);
    expect(pts[0]!.y).toBeCloseTo(0);
    expect(pts[0]!.z).toBeCloseTo(0);
  });

  it("rotates face centers with the object (OBB, not AABB)", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.rotation.y = Math.PI / 4;
    mesh.updateMatrixWorld(true);
    const pts = bboxFeatures(mesh);
    const fc = pts[9]!; // +X face center
    expect(Math.hypot(fc.x, fc.z)).toBeCloseTo(1, 5);
  });

  it("returns [] for an object with no mesh geometry", () => {
    expect(bboxFeatures(new THREE.Group())).toEqual([]);
  });
});

describe("computeSnapOffset priority chain", () => {
  it("returns a (near-zero) grid offset when no socket/node path matches", () => {
    const off = computeSnapOffset({
      currentPos: [0, 0, 0],
      draggedFeatures: [],
      draggedSockets: [],
      hasSockets: false,
      targetFeatures: [],
      targetSockets: [],
    });
    expect(off).not.toBeNull();
    expect(off![0]).toBeCloseTo(0);
  });

  it("prefers a socket-align offset over node/grid when within threshold", () => {
    const dragged: SnapPoint = { screen: [100, 100], world: [0, 0, 0] };
    const off = computeSnapOffset({
      currentPos: [0, 0, 0],
      draggedFeatures: [dragged],
      draggedSockets: [{ screen: [100, 100], world: [0, 0, 0], tag: "a" }],
      hasSockets: true,
      targetFeatures: [],
      targetSockets: [{ screen: [101, 101], world: [1, 0, 0], tag: "a" }],
    });
    expect(off).not.toBeNull();
    expect(off![0]).toBeCloseTo(1);
  });

  it("uses node-align offset (over grid) only when the node has no sockets", () => {
    const args = {
      currentPos: [0, 0, 0] as [number, number, number],
      draggedFeatures: [{ screen: [100, 100], world: [0, 0, 0] }] as SnapPoint[],
      draggedSockets: [],
      targetFeatures: [{ screen: [101, 101], world: [1, 0, 0] }] as SnapPoint[],
      targetSockets: [],
    };
    // hasSockets=false → node-align is consulted and wins over grid.
    const node = computeSnapOffset({ ...args, hasSockets: false });
    expect(node).not.toBeNull();
    expect(node![0]).toBeCloseTo(1);
    // hasSockets=true → node-align is skipped; with no socket target it falls
    // through to grid (≈zero offset from the origin), NOT the node offset.
    const skipped = computeSnapOffset({ ...args, hasSockets: true });
    expect(skipped![0]).toBeCloseTo(0);
  });
});
