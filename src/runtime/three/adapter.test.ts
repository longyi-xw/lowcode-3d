import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { RuntimeTarget } from "@/core/scene/types";
import { ThreeAdapter } from "./adapter";

const target: RuntimeTarget = {
  kind: "three.js",
  version: "0.184.0",
  module_format: "esm",
};

describe("ThreeAdapter constructor", () => {
  it("constructs an empty THREE.Scene", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.scene).toBeInstanceOf(THREE.Scene);
    expect(adapter.scene.children).toEqual([]);
  });

  it("starts with a perspective camera at the default position", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(adapter.camera.position.toArray()).toEqual([4, 3, 4]);
  });

  it("respects defaultCamera overrides", () => {
    const adapter = new ThreeAdapter(target, {
      defaultCamera: { fov: 75, position: [10, 5, 10], near: 0.5, far: 500 },
    });
    const cam = adapter.camera as THREE.PerspectiveCamera;
    expect(cam.fov).toBe(75);
    expect(cam.near).toBe(0.5);
    expect(cam.far).toBe(500);
    expect(cam.position.toArray()).toEqual([10, 5, 10]);
  });

  it("uses the canonical target when no argument is supplied", () => {
    const adapter = new ThreeAdapter();
    expect(adapter.target.kind).toBe("three.js");
  });
});

describe("ThreeAdapter shell methods", () => {
  it("getRuntimeObject returns undefined for unknown ids", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getRuntimeObject("nope")).toBeUndefined();
  });

  it("getSupportedBehaviors returns an empty list (real behaviors land in v0.5)", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getSupportedBehaviors()).toEqual([]);
  });

  it("syncNode throws NotImplementedYet until the next commit lands", () => {
    const adapter = new ThreeAdapter(target);
    expect(() =>
      adapter.syncNode(
        {
          id: "n1",
          name: "n1",
          type: "group",
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          parent_id: null,
          children_ids: [],
          visible: true,
          locked: false,
          data: { type: "group" },
          behaviors: [],
          user_data: {},
        },
        "add",
      ),
    ).toThrow(/not implemented yet/);
  });

  it("pickAt throws until the viewport wires raycasting", () => {
    const adapter = new ThreeAdapter(target);
    expect(() => adapter.pickAt(0, 0)).toThrow(/not implemented yet/);
  });
});

describe("ThreeAdapter dispose", () => {
  it("clears the scene and object map", () => {
    const adapter = new ThreeAdapter(target);
    adapter.scene.add(new THREE.Object3D());
    expect(adapter.scene.children.length).toBe(1);
    adapter.dispose();
    expect(adapter.scene.children).toEqual([]);
  });
});
