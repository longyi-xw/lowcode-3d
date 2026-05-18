import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { RuntimeTarget, SceneNode, Transform } from "@/core/scene/types";
import { ThreeAdapter } from "./adapter";

const target: RuntimeTarget = {
  kind: "three.js",
  version: "0.184.0",
  module_format: "esm",
};

const identityTransform: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function makeGroupNode(id: string, overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform: identityTransform,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
    ...overrides,
  };
}

function makeMeshNode(id: string, asset_id = "asset-1"): SceneNode {
  return {
    id,
    name: id,
    type: "mesh",
    transform: identityTransform,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", asset_id },
    behaviors: [],
    user_data: {},
  };
}

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

describe("ThreeAdapter.syncNode add path", () => {
  it("adds a group as a THREE.Group under the scene root", () => {
    const adapter = new ThreeAdapter(target);
    const node = makeGroupNode("g1", { name: "Root" });
    adapter.syncNode(node, "add");

    const obj = adapter.getRuntimeObject("g1");
    expect(obj).toBeInstanceOf(THREE.Group);
    expect(obj?.name).toBe("Root");
    expect(adapter.scene.children).toContain(obj);
    expect(obj?.userData.nodeId).toBe("g1");
  });

  it("attaches a child to its parent's Three.js object, not the scene root", () => {
    const adapter = new ThreeAdapter(target);
    const parent = makeGroupNode("parent");
    const child = makeGroupNode("child", { parent_id: "parent" });
    adapter.syncNode(parent, "add");
    adapter.syncNode(child, "add");

    const parentObj = adapter.getRuntimeObject("parent");
    const childObj = adapter.getRuntimeObject("child");
    expect(parentObj?.children).toContain(childObj);
    expect(adapter.scene.children).not.toContain(childObj);
  });

  it("applies the SceneNode transform to the Three.js object", () => {
    const adapter = new ThreeAdapter(target);
    const node = makeGroupNode("g1", {
      transform: {
        position: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [2, 2, 2],
      },
    });
    adapter.syncNode(node, "add");
    const obj = adapter.getRuntimeObject("g1");
    expect(obj?.position.toArray()).toEqual([1, 2, 3]);
    expect(obj?.scale.toArray()).toEqual([2, 2, 2]);
  });

  it("propagates visible to Three.js", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1", { visible: false }), "add");
    expect(adapter.getRuntimeObject("g1")?.visible).toBe(false);
  });

  it("throws when the same id is added twice", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1"), "add");
    expect(() => adapter.syncNode(makeGroupNode("g1"), "add")).toThrow(
      /already exists/,
    );
  });

  it("throws when parent is not registered", () => {
    const adapter = new ThreeAdapter(target);
    expect(() =>
      adapter.syncNode(makeGroupNode("child", { parent_id: "missing" }), "add"),
    ).toThrow(/parent missing not found/);
  });

  it("creates a mesh with a placeholder cube geometry + standard material", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("m1"), "add");
    const mesh = adapter.getRuntimeObject("m1") as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mesh.userData.assetId).toBe("asset-1");
  });

  it("creates a directional light with the requested color and intensity", () => {
    const adapter = new ThreeAdapter(target);
    const node: SceneNode = {
      id: "L1",
      name: "Key",
      type: "light",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "light",
        light_kind: "directional",
        color: "#ffaa00",
        intensity: 1.5,
        cast_shadow: true,
      },
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(node, "add");
    const light = adapter.getRuntimeObject("L1") as THREE.DirectionalLight;
    expect(light).toBeInstanceOf(THREE.DirectionalLight);
    expect(light.color.getHexString()).toBe("ffaa00");
    expect(light.intensity).toBe(1.5);
    expect(light.castShadow).toBe(true);
  });

  it("creates a perspective camera with the requested fov", () => {
    const adapter = new ThreeAdapter(target);
    const node: SceneNode = {
      id: "C1",
      name: "Main",
      type: "camera",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "camera",
        camera_kind: "perspective",
        fov: 60,
        near: 0.1,
        far: 100,
      },
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(node, "add");
    const cam = adapter.getRuntimeObject("C1") as THREE.PerspectiveCamera;
    expect(cam).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(cam.fov).toBe(60);
    expect(cam.far).toBe(100);
  });

  it("creates a grid helper when helper_kind === 'grid'", () => {
    const adapter = new ThreeAdapter(target);
    const node: SceneNode = {
      id: "H1",
      name: "Grid",
      type: "helper",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "helper", helper_kind: "grid" },
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(node, "add");
    expect(adapter.getRuntimeObject("H1")).toBeInstanceOf(THREE.GridHelper);
  });
});

describe("ThreeAdapter.syncNode update path", () => {
  it("re-applies transform on update", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1"), "add");
    adapter.syncNode(
      makeGroupNode("g1", {
        transform: {
          position: [5, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      }),
      "update",
    );
    expect(adapter.getRuntimeObject("g1")?.position.toArray()).toEqual([5, 0, 0]);
  });

  it("updates a light's intensity in place without recreating the object", () => {
    const adapter = new ThreeAdapter(target);
    const node: SceneNode = {
      id: "L1",
      name: "L",
      type: "light",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "light",
        light_kind: "point",
        color: "#ffffff",
        intensity: 1,
      },
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(node, "add");
    const before = adapter.getRuntimeObject("L1");
    adapter.syncNode(
      { ...node, data: { ...node.data, intensity: 4 } as never },
      "update",
    );
    const after = adapter.getRuntimeObject("L1");
    expect(after).toBe(before);
    expect((after as THREE.PointLight).intensity).toBe(4);
  });

  it("throws when updating a node that was never added", () => {
    const adapter = new ThreeAdapter(target);
    expect(() => adapter.syncNode(makeGroupNode("ghost"), "update")).toThrow(
      /not found/,
    );
  });
});

describe("ThreeAdapter.syncNode remove path", () => {
  it("detaches the object and frees the id slot", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1"), "add");
    expect(adapter.scene.children.length).toBe(1);

    adapter.syncNode(makeGroupNode("g1"), "remove");
    expect(adapter.scene.children).toEqual([]);
    expect(adapter.getRuntimeObject("g1")).toBeUndefined();
  });

  it("detaches a child from its parent without touching the scene root", () => {
    const adapter = new ThreeAdapter(target);
    const parent = makeGroupNode("parent");
    const child = makeGroupNode("child", { parent_id: "parent" });
    adapter.syncNode(parent, "add");
    adapter.syncNode(child, "add");
    adapter.syncNode(child, "remove");

    const parentObj = adapter.getRuntimeObject("parent");
    expect(parentObj?.children).toEqual([]);
    expect(adapter.scene.children).toContain(parentObj);
  });

  it("is idempotent for an already-removed node", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1"), "add");
    adapter.syncNode(makeGroupNode("g1"), "remove");
    expect(() => adapter.syncNode(makeGroupNode("g1"), "remove")).not.toThrow();
  });

  it("disposes geometry and material on mesh removal", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("m1"), "add");
    const mesh = adapter.getRuntimeObject("m1") as THREE.Mesh;
    const geometry = mesh.geometry;
    const material = mesh.material as THREE.Material;
    let geomDisposed = false;
    let matDisposed = false;
    geometry.addEventListener("dispose", () => {
      geomDisposed = true;
    });
    material.addEventListener("dispose", () => {
      matDisposed = true;
    });

    adapter.syncNode(makeMeshNode("m1"), "remove");

    expect(geomDisposed).toBe(true);
    expect(matDisposed).toBe(true);
  });
});

describe("ThreeAdapter.syncNode unsupported paths", () => {
  it("rejects 'custom' nodes until a custom registry exists", () => {
    const adapter = new ThreeAdapter(target);
    const node: SceneNode = {
      id: "X1",
      name: "x",
      type: "custom",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "custom", custom_type: "billboard", payload: {} },
      behaviors: [],
      user_data: {},
    };
    expect(() => adapter.syncNode(node, "add")).toThrow(/custom/);
  });
});

describe("ThreeAdapter shell methods still pending", () => {
  it("getRuntimeObject returns undefined for unknown ids", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getRuntimeObject("nope")).toBeUndefined();
  });

  it("getSupportedBehaviors returns an empty list (real behaviors land in v0.5)", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getSupportedBehaviors()).toEqual([]);
  });

  it("pickAt throws until the viewport wires raycasting", () => {
    const adapter = new ThreeAdapter(target);
    expect(() => adapter.pickAt(0, 0)).toThrow(/not implemented yet/);
  });

  it("syncAsset throws until asset loading lands", async () => {
    const adapter = new ThreeAdapter(target);
    await expect(
      adapter.syncAsset({
        id: "a1",
        content_hash: "sha256-deadbeef",
        kind: "geometry",
        relative_path: "x.glb",
        tags: [],
        description: "",
        source: { kind: "user_upload", original_filename: "x.glb" },
      }),
    ).rejects.toThrow(/not implemented yet/);
  });
});

describe("ThreeAdapter.dispose", () => {
  it("clears registered objects, the scene, and the object map", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeGroupNode("g1"), "add");
    adapter.syncNode(makeMeshNode("m1"), "add");
    adapter.dispose();
    expect(adapter.scene.children).toEqual([]);
    expect(adapter.getRuntimeObject("g1")).toBeUndefined();
    expect(adapter.getRuntimeObject("m1")).toBeUndefined();
  });
});
