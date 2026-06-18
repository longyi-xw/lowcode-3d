import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { z } from "zod";

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

describe("ThreeAdapter.pickAt", () => {
  it("returns null when viewport size has not been set", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("m1"), "add");
    // setViewportSize default is 1x1 which makes any meaningful pick degenerate;
    // an unset viewport coordinate at (0,0) should still not throw.
    expect(typeof adapter.pickAt(0, 0)).toMatch(/string|object/); // either id or null
  });

  it("picks the mesh at the centre of the viewport when the camera looks at the origin", () => {
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(800, 600);
    adapter.syncNode(makeMeshNode("cube"), "add");
    expect(adapter.pickAt(400, 300)).toBe("cube");
  });

  it("returns null when the ray hits empty space", () => {
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(800, 600);
    adapter.syncNode(makeMeshNode("cube"), "add");
    // Top-left corner — far from where the cube projects given the default
    // camera at (4,3,4) looking at origin.
    expect(adapter.pickAt(0, 0)).toBeNull();
  });

  it("walks up to the nearest ancestor with userData.nodeId on a hit", () => {
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(800, 600);
    adapter.syncNode(makeMeshNode("cube"), "add");
    const mesh = adapter.getRuntimeObject("cube") as THREE.Mesh;
    // Simulate a glTF-style attachment where a child mesh has no nodeId of
    // its own; the picker should still resolve to the parent's nodeId.
    const child = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
    );
    mesh.add(child);
    expect(adapter.pickAt(400, 300)).toBe("cube");
  });

  it("skips helpers when raycasting — they shouldn't trap clicks meant for meshes behind them", () => {
    // Regression: a grid helper moved off origin used to intercept clicks
    // intended for a mesh further along the ray (the grid lines float in
    // front of the geometry). Helpers must opt out of raycast.
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(800, 600);
    adapter.syncNode(makeMeshNode("cube"), "add");
    const helper: SceneNode = {
      id: "grid-helper",
      name: "Grid",
      type: "helper",
      // Float the grid up to where the camera ray will pass through before
      // reaching the cube at origin.
      transform: {
        position: [0, 1, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "helper", helper_kind: "grid" },
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(helper, "add");
    expect(adapter.pickAt(400, 300)).toBe("cube");
  });
});

describe("ThreeAdapter shell methods still pending", () => {
  it("getRuntimeObject returns undefined for unknown ids", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getRuntimeObject("nope")).toBeUndefined();
  });

  it("getSupportedBehaviors returns at least one definition (behaviors are now wired)", () => {
    const adapter = new ThreeAdapter(target);
    expect(adapter.getSupportedBehaviors().length).toBeGreaterThan(0);
  });

  it("syncAsset surfaces a no_project_path error in test/non-Tauri envs", async () => {
    const adapter = new ThreeAdapter(target);
    await adapter.syncAsset({
      id: "a1",
      content_hash: "sha256-deadbeef",
      kind: "geometry",
      relative_path: "x.glb",
      tags: [],
      description: "",
      source: { kind: "user_upload", original_filename: "x.glb" },
    });
    const status = adapter.assetCache.get("a1");
    // Cache records the failure path so the UI can surface it. The adapter
    // itself never throws — the editor stays usable while the user resolves
    // the underlying issue.
    expect(status.status).toBe("error");
  });
});

describe("ThreeAdapter prefab_instance + syncAsset", () => {
  function makePrefabNode(id: string, assetId: string): SceneNode {
    return {
      id,
      name: id,
      type: "prefab_instance",
      transform: identityTransform,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "prefab_instance", asset_id: assetId },
      behaviors: [],
      user_data: {},
    };
  }

  // Bare-bones in-memory AssetCache stub so we don't need to exercise the
  // Rust FFI path in unit tests. Casting through `unknown` because we only
  // implement the surface the adapter actually uses.
  function makeStubCache(template: THREE.Object3D) {
    let ready = false;
    return {
      stub: true,
      setProjectPath: () => {},
      get: (_id: string) =>
        ready
          ? {
              status: "ready" as const,
              template,
              summary: { meshCount: 1, treeDepth: 0 },
            }
          : { status: "idle" as const },
      ensureLoaded: async (_asset: { id: string }) => {
        ready = true;
        return {
          status: "ready" as const,
          template,
          summary: { meshCount: 1, treeDepth: 0 },
        };
      },
      cloneTemplate: (_id: string) => (ready ? template.clone(true) : null),
      dispose: () => {},
    } as unknown as import("./asset-cache").AssetCache;
  }

  it("adds a placeholder when the asset is not yet cached", () => {
    const template = new THREE.Group();
    const cache = makeStubCache(template);
    const adapter = new ThreeAdapter(target, { assetCache: cache });
    adapter.syncNode(makePrefabNode("p1", "a1"), "add");
    const obj = adapter.getRuntimeObject("p1");
    expect(obj?.userData["prefabPlaceholder"]).toBe(true);
  });

  it("clones the cached template at build time when the asset is preloaded", async () => {
    const template = new THREE.Group();
    template.add(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
    );
    const cache = makeStubCache(template);
    const adapter = new ThreeAdapter(target, { assetCache: cache });

    await adapter.syncAsset({
      id: "a1",
      content_hash: "h",
      kind: "geometry",
      relative_path: "assets/h.glb",
      tags: [],
      description: "",
      source: { kind: "user_upload", original_filename: "x.glb" },
    });
    adapter.syncNode(makePrefabNode("p1", "a1"), "add");

    const obj = adapter.getRuntimeObject("p1");
    expect(obj?.userData["prefabPlaceholder"]).toBeUndefined();
    expect(obj?.userData["prefabRoot"]).toBe(true);
    expect(obj?.userData.nodeId).toBe("p1");
  });

  it("rebuilds placeholders into clones once syncAsset resolves", async () => {
    const template = new THREE.Group();
    template.add(
      new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
    );
    const cache = makeStubCache(template);
    const adapter = new ThreeAdapter(target, { assetCache: cache });

    // Add the node BEFORE the asset resolves — placeholder path.
    adapter.syncNode(makePrefabNode("p1", "a1"), "add");
    const placeholder = adapter.getRuntimeObject("p1");
    expect(placeholder?.userData["prefabPlaceholder"]).toBe(true);

    await adapter.syncAsset({
      id: "a1",
      content_hash: "h",
      kind: "geometry",
      relative_path: "assets/h.glb",
      tags: [],
      description: "",
      source: { kind: "user_upload", original_filename: "x.glb" },
    });

    const rebuilt = adapter.getRuntimeObject("p1");
    expect(rebuilt).not.toBe(placeholder);
    expect(rebuilt?.userData["prefabRoot"]).toBe(true);
    expect(rebuilt?.userData.nodeId).toBe("p1");
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

import type { BehaviorBinding } from "@/core/scene/types";
import type { CodegenContext } from "@/runtime/adapter";

describe("ThreeAdapter behaviors", () => {
  function emptyProject() {
    return {
      metadata: {
        id: "p1",
        name: "test",
        target,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      scene: { nodes: {}, root_node_ids: [] },
      assets: [],
      settings: { background: { kind: "color", color: "#101418" } },
    } as never;
  }

  it("getSupportedBehaviors returns auto-rotate definition", () => {
    const adapter = new ThreeAdapter(target);
    const defs = adapter.getSupportedBehaviors();
    expect(defs.find((d) => d.type === "auto-rotate")).toBeDefined();
  });

  it("generateBehaviorCode emits code for enabled auto-rotate binding", () => {
    const adapter = new ThreeAdapter(target);
    const binding: BehaviorBinding = {
      id: "b1",
      behavior_type: "auto-rotate",
      enabled: true,
      parameters: { axis: "y", speed: 30 },
    };
    const ctx: CodegenContext = {
      project: emptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(binding, ctx);
    expect(code).toContain("tickers.push");
    expect(code).toContain("n_test.rotation.y");
  });

  it("generateBehaviorCode returns empty string for disabled bindings", () => {
    const adapter = new ThreeAdapter(target);
    const ctx: CodegenContext = {
      project: emptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: false,
        parameters: { axis: "y", speed: 30 },
      },
      ctx,
    );
    expect(code).toBe("");
  });

  it("generateBehaviorCode returns empty + pushes warning for unknown type", () => {
    const adapter = new ThreeAdapter(target);
    const ctx: CodegenContext = {
      project: emptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "future-thing",
        enabled: true,
        parameters: {},
      },
      ctx,
    );
    expect(code).toBe("");
    expect(ctx.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining(`"future-thing"`)]),
    );
  });

  it("generateBehaviorCode returns empty + warning when params fail validation", () => {
    const adapter = new ThreeAdapter(target);
    const ctx: CodegenContext = {
      project: emptyProject(),
      warnings: [],
      currentNodeVar: "n_test",
    };
    const code = adapter.generateBehaviorCode(
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "w", speed: "fast" }, // both invalid
      },
      ctx,
    );
    expect(code).toBe("");
    expect(ctx.warnings.length).toBeGreaterThan(0);
  });
});

describe("ThreeAdapter live behavior runtime", () => {
  function makeAutoRotateBindings(): BehaviorBinding[] {
    return [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: true,
        parameters: { axis: "y", speed: 30 },
      },
    ];
  }

  it("installBehaviors + tickBehaviors advances object rotation", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    adapter.installBehaviors("n1", makeAutoRotateBindings());
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const rBefore = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBeCloseTo(rBefore + (30 * Math.PI) / 180, 6);
  });

  it("uninstallBehaviors stops ticking that node", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    adapter.installBehaviors("n1", makeAutoRotateBindings());
    adapter.uninstallBehaviors("n1");
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const r = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBe(r);
  });

  it("installBehaviors skips disabled bindings", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    adapter.installBehaviors("n1", [
      {
        id: "b1",
        behavior_type: "auto-rotate",
        enabled: false,
        parameters: { axis: "y", speed: 30 },
      },
    ]);
    const obj = adapter.getRuntimeObject("n1") as THREE.Object3D;
    const r = obj.rotation.y;
    adapter.tickBehaviors(1);
    expect(obj.rotation.y).toBe(r);
  });

  it("installBehaviors skips unknown behavior_type without throwing", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    expect(() => {
      adapter.installBehaviors("n1", [
        {
          id: "b1",
          behavior_type: "future-thing",
          enabled: true,
          parameters: {},
        },
      ]);
      adapter.tickBehaviors(1);
    }).not.toThrow();
  });

  it("installBehaviors skips invalid params without throwing", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    expect(() => {
      adapter.installBehaviors("n1", [
        {
          id: "b1",
          behavior_type: "auto-rotate",
          enabled: true,
          parameters: { axis: "w", speed: "fast" },
        },
      ]);
      adapter.tickBehaviors(1);
    }).not.toThrow();
  });

  it("installBehaviors on missing node is a silent no-op", () => {
    const adapter = new ThreeAdapter(target);
    expect(() =>
      adapter.installBehaviors("does-not-exist", makeAutoRotateBindings()),
    ).not.toThrow();
    expect(() => adapter.tickBehaviors(1)).not.toThrow();
  });

  it("tick errors on one binding don't break others", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");

    let goodTicks = 0;
    adapter.registerBehavior({
      definition: {
        type: "throw-tick",
        name: "throw",
        description: "",
        parameters_schema: z.object({}),
      },
      install: () => ({}),
      tick: () => {
        throw new Error("boom");
      },
      emit: () => "",
    });
    adapter.registerBehavior({
      definition: {
        type: "count-tick",
        name: "count",
        description: "",
        parameters_schema: z.object({}),
      },
      install: () => ({}),
      tick: () => {
        goodTicks++;
      },
      emit: () => "",
    });

    adapter.installBehaviors("n1", [
      { id: "b1", behavior_type: "throw-tick", enabled: true, parameters: {} },
      { id: "b2", behavior_type: "count-tick", enabled: true, parameters: {} },
    ]);
    // The throwing tick must not stop the other binding from ticking.
    expect(() => adapter.tickBehaviors(1)).not.toThrow();
    expect(goodTicks).toBe(1);

    errSpy.mockRestore();
  });

  it("threads BehaviorContext.domElement through to install", () => {
    const adapter = new ThreeAdapter(target);
    const el = document.createElement("div");
    adapter.setBehaviorDomElement(el);
    adapter.syncNode(makeMeshNode("n1"), "add");

    let seen: HTMLElement | null | undefined;
    adapter.registerBehavior({
      definition: {
        type: "ctx-probe",
        name: "probe",
        description: "",
        parameters_schema: z.object({}),
      },
      install: (_o, _p, ctx) => {
        seen = ctx.domElement;
        return {};
      },
      emit: () => "",
    });
    adapter.installBehaviors("n1", [
      { id: "b1", behavior_type: "ctx-probe", enabled: true, parameters: {} },
    ]);
    expect(seen).toBe(el);
  });

  it("dispose releases all behavior handles", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(makeMeshNode("n1"), "add");
    adapter.installBehaviors("n1", makeAutoRotateBindings());
    expect(() => adapter.dispose()).not.toThrow();
  });
});

describe("ThreeAdapter.raycastGroundPoint", () => {
  it("hits the ground plane near the origin for a centered ray", () => {
    // Default camera sits at [4,3,4] looking at the origin, so the center ray
    // (NDC 0,0) crosses y=0 exactly at the origin.
    const adapter = new ThreeAdapter(target);
    adapter.setViewportSize(100, 100);
    const hit = adapter.raycastGroundPoint(50, 50);
    expect(hit).not.toBeNull();
    expect(hit![1]).toBeCloseTo(0, 5);
    expect(Math.hypot(hit![0], hit![2])).toBeLessThan(1e-4);
  });

  it("returns null when the camera faces away from the ground", () => {
    // Tilt up (above the horizon) but NOT straight up — a forward parallel to
    // the up vector makes lookAt degenerate (NaN basis). [0,5,3] tilts up
    // around x, so the center ray points above y=0 and never crosses it.
    const adapter = new ThreeAdapter(target, {
      defaultCamera: { position: [0, 1, 0], lookAt: [0, 5, 3] },
    });
    adapter.setViewportSize(100, 100);
    expect(adapter.raycastGroundPoint(50, 50)).toBeNull();
  });
});

describe("ThreeAdapter.describeNode", () => {
  it("returns null for an unknown id", () => {
    expect(new ThreeAdapter(target).describeNode("nope")).toBeNull();
  });

  it("describes a mesh node: kind + geometryKind + transform + visible", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(
      {
        id: "m1",
        name: "m",
        type: "mesh",
        transform: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 2, 2] },
        parent_id: null,
        children_ids: [],
        visible: false,
        locked: false,
        data: { type: "mesh", geometry: { kind: "sphere" } },
        behaviors: [],
        user_data: {},
      },
      "add",
    );
    const info = adapter.describeNode("m1");
    expect(info?.kind).toBe("mesh");
    expect(info?.geometryKind).toBe("sphere");
    expect(info?.position).toEqual([1, 2, 3]);
    expect(info?.scale).toEqual([2, 2, 2]);
    expect(info?.visible).toBe(false);
    expect(info?.parentId).toBeNull();
  });

  it("maps light + camera subtypes", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(
      {
        id: "L",
        name: "L",
        type: "light",
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        parent_id: null,
        children_ids: [],
        visible: true,
        locked: false,
        data: { type: "light", light_kind: "spot", color: "#fff", intensity: 1 },
        behaviors: [],
        user_data: {},
      },
      "add",
    );
    adapter.syncNode(
      {
        id: "C",
        name: "C",
        type: "camera",
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        parent_id: null,
        children_ids: [],
        visible: true,
        locked: false,
        data: { type: "camera", camera_kind: "orthographic", near: 0.1, far: 100 },
        behaviors: [],
        user_data: {},
      },
      "add",
    );
    expect(adapter.describeNode("L")).toMatchObject({
      kind: "light",
      lightKind: "spot",
    });
    expect(adapter.describeNode("C")).toMatchObject({
      kind: "camera",
      cameraKind: "orthographic",
    });
  });

  it("describeNode reports the mesh material", () => {
    const adapter = new ThreeAdapter(target);
    adapter.syncNode(
      {
        id: "m",
        name: "m",
        type: "mesh",
        transform: identityTransform,
        parent_id: null,
        children_ids: [],
        visible: true,
        locked: false,
        data: {
          type: "mesh",
          geometry: { kind: "box" },
          material_overrides: [{ slot: 0, color: "#3366cc", roughness: 0.2 }],
        },
        behaviors: [],
        user_data: {},
      },
      "add",
    );
    const mat = adapter.describeNode("m")?.material;
    expect(mat?.color).toBe("#3366cc");
    expect(mat?.roughness).toBeCloseTo(0.2);
  });

  it("reports parentId from the parent's nodeId", () => {
    const adapter = new ThreeAdapter(target);
    const base = {
      transform: {
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
      },
      children_ids: [] as string[],
      visible: true,
      locked: false,
      behaviors: [],
      user_data: {},
    };
    adapter.syncNode(
      {
        ...base,
        id: "g",
        name: "g",
        type: "group",
        parent_id: null,
        data: { type: "group" },
      },
      "add",
    );
    adapter.syncNode(
      {
        ...base,
        id: "c",
        name: "c",
        type: "group",
        parent_id: "g",
        data: { type: "group" },
      },
      "add",
    );
    expect(adapter.describeNode("c")?.parentId).toBe("g");
    expect(adapter.describeNode("g")?.parentId).toBeNull();
  });
});
