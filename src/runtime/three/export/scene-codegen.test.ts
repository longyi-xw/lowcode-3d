import { describe, expect, it } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import type {
  AssetReference,
  BehaviorBinding,
  RuntimeTarget,
  SceneNode,
  SceneProject,
} from "@/core/scene/types";

import type { CodegenContext } from "@/runtime/adapter";

import { generateSceneModule } from "./scene-codegen";

const TARGET: RuntimeTarget = {
  kind: "three.js",
  version: "0.184.0",
  module_format: "esm",
};

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function emptyProject(): SceneProject {
  return createDefaultProject({
    id: "p1",
    name: "test",
    target: TARGET,
    now: new Date("2026-01-01T00:00:00Z"),
  });
}

function withNodes(
  base: SceneProject,
  nodes: SceneNode[],
  roots: string[],
  assets: AssetReference[] = [],
): SceneProject {
  return {
    ...base,
    scene: {
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      root_node_ids: roots,
    },
    assets,
  };
}

describe("generateSceneModule", () => {
  it("returns a valid ES module shell for an empty project", () => {
    const out = generateSceneModule({ project: emptyProject() });
    expect(out.sceneModuleSource).toMatch(/import \* as THREE from "three";/);
    expect(out.sceneModuleSource).toMatch(/export async function buildScene\(\)/);
    expect(out.sceneModuleSource).toContain("const interactions = [];");
    expect(out.sceneModuleSource).toMatch(
      /return \{ scene, camera, templates, tickers, interactions \};/,
    );
    expect(out.warnings).toEqual([]);
    expect(out.referencedAssets).toEqual([]);
  });

  it("emits a group + a light under it with correct parent-child wiring", () => {
    const p = withNodes(
      emptyProject(),
      [
        {
          id: "g1",
          name: "Models",
          type: "group",
          transform: IDENTITY,
          parent_id: null,
          children_ids: ["L1"],
          visible: true,
          locked: false,
          data: { type: "group" },
          behaviors: [],
          user_data: {},
        },
        {
          id: "L1",
          name: "Key",
          type: "light",
          transform: { ...IDENTITY, position: [3, 5, 3] },
          parent_id: "g1",
          children_ids: [],
          visible: true,
          locked: false,
          data: {
            type: "light",
            light_kind: "directional",
            color: "#ffffff",
            intensity: 1.2,
            cast_shadow: true,
          },
          behaviors: [],
          user_data: {},
        },
      ],
      ["g1"],
    );

    const out = generateSceneModule({ project: p });
    // Parent group lands first, then the child light is added to it.
    expect(out.sceneModuleSource).toMatch(/const n_g1 = new THREE\.Group\(\);/);
    expect(out.sceneModuleSource).toMatch(
      /const n_L1 = new THREE\.DirectionalLight\("#ffffff", 1\.2\);/,
    );
    expect(out.sceneModuleSource).toMatch(/n_L1\.castShadow = true;/);
    expect(out.sceneModuleSource).toMatch(/scene\.add\(n_g1\);/);
    expect(out.sceneModuleSource).toMatch(/n_g1\.add\(n_L1\);/);
  });

  it("skips helper nodes and surfaces a warning", () => {
    const p = withNodes(
      emptyProject(),
      [
        {
          id: "h1",
          name: "Grid",
          type: "helper",
          transform: IDENTITY,
          parent_id: null,
          children_ids: [],
          visible: true,
          locked: false,
          data: { type: "helper", helper_kind: "grid" },
          behaviors: [],
          user_data: {},
        },
      ],
      ["h1"],
    );
    const out = generateSceneModule({ project: p });
    expect(out.sceneModuleSource).not.toMatch(/h1|GridHelper/);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/helper.*editor chrome/);
  });

  it("emits a prefab_instance with loadAsset call + tracks the referenced asset", () => {
    const asset: AssetReference = {
      id: "asset-h1",
      content_hash: "h1",
      kind: "geometry",
      relative_path: "assets/h1.glb",
      tags: [],
      description: "",
      source: { kind: "user_upload", original_filename: "model.glb" },
    };
    const p = withNodes(
      emptyProject(),
      [
        {
          id: "p1",
          name: "Model",
          type: "prefab_instance",
          transform: IDENTITY,
          parent_id: null,
          children_ids: [],
          visible: true,
          locked: false,
          data: { type: "prefab_instance", asset_id: "asset-h1" },
          behaviors: [],
          user_data: {},
        },
      ],
      ["p1"],
      [asset],
    );

    const out = generateSceneModule({ project: p });
    expect(out.sceneModuleSource).toMatch(
      /const n_p1_tpl = await loadAsset\("asset-h1", "\.\/assets\/h1\.glb"\);/,
    );
    expect(out.sceneModuleSource).toMatch(/const n_p1 = n_p1_tpl\.clone\(true\);/);
    expect(out.referencedAssets).toEqual([asset]);
  });

  it("emits no TypeScript-only syntax in the body", () => {
    const p = withNodes(
      emptyProject(),
      [
        {
          id: "c1",
          name: "Cam",
          type: "camera",
          transform: IDENTITY,
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
        },
      ],
      ["c1"],
    );
    const src = generateSceneModule({ project: p }).sceneModuleSource;
    // No TS interfaces, no annotations, no `(expr) as Type` casts, no
    // generic args at call sites. The plain-JS guarantee is what lets the
    // Standalone ESM emitter serve scene.js verbatim from the browser
    // without a build. `import * as THREE` is fine — that's ESM, not TS.
    expect(src).not.toMatch(/\binterface\b/);
    expect(src).not.toMatch(/:\s*THREE\./);
    expect(src).not.toMatch(/\)\s+as\s+[A-Z]/);
    expect(src).not.toMatch(/new Promise<[^>]+>/);
  });

  it("emits visibility = false when the node is hidden", () => {
    const p = withNodes(
      emptyProject(),
      [
        {
          id: "g1",
          name: "Hidden",
          type: "group",
          transform: IDENTITY,
          parent_id: null,
          children_ids: [],
          visible: false,
          locked: false,
          data: { type: "group" },
          behaviors: [],
          user_data: {},
        },
      ],
      ["g1"],
    );
    expect(generateSceneModule({ project: p }).sceneModuleSource).toMatch(
      /n_g1\.visible = false;/,
    );
  });
});

describe("scene-codegen mesh geometry", () => {
  function meshGeomNode(kind?: "box" | "sphere" | "plane" | "cylinder"): SceneNode {
    return {
      id: "m1",
      name: "M1",
      type: "mesh",
      transform: IDENTITY,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: kind
        ? { type: "mesh", geometry: { kind } }
        : { type: "mesh", asset_id: "x" },
      behaviors: [],
      user_data: {},
    };
  }

  it.each([
    ["box", /new THREE\.BoxGeometry\(/],
    ["sphere", /new THREE\.SphereGeometry\(/],
    ["plane", /new THREE\.PlaneGeometry\(/],
    ["cylinder", /new THREE\.CylinderGeometry\(/],
  ] as const)("emits %s geometry", (kind, re) => {
    const p = withNodes(emptyProject(), [meshGeomNode(kind)], ["m1"]);
    expect(generateSceneModule({ project: p }).sceneModuleSource).toMatch(re);
  });

  it("emits a box for a legacy mesh without a geometry descriptor", () => {
    const p = withNodes(emptyProject(), [meshGeomNode()], ["m1"]);
    expect(generateSceneModule({ project: p }).sceneModuleSource).toMatch(
      /new THREE\.BoxGeometry\(/,
    );
  });
});

describe("scene-codegen mesh material", () => {
  function meshMatNode(override?: {
    slot: number;
    color?: string;
    metalness?: number;
    opacity?: number;
  }): SceneNode {
    return {
      id: "m1",
      name: "M1",
      type: "mesh",
      transform: IDENTITY,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "mesh",
        geometry: { kind: "box" },
        material_overrides: override ? [override] : undefined,
      },
      behaviors: [],
      user_data: {},
    };
  }

  it("emits override color + metalness", () => {
    const p = withNodes(
      emptyProject(),
      [meshMatNode({ slot: 0, color: "#ff0000", metalness: 0.8 })],
      ["m1"],
    );
    const src = generateSceneModule({ project: p }).sceneModuleSource;
    expect(src).toMatch(/color: "#ff0000"/);
    expect(src).toMatch(/metalness: 0\.8/);
  });

  it("emits transparent: true when opacity < 1", () => {
    const p = withNodes(
      emptyProject(),
      [meshMatNode({ slot: 0, opacity: 0.5 })],
      ["m1"],
    );
    const src = generateSceneModule({ project: p }).sceneModuleSource;
    expect(src).toMatch(/opacity: 0\.5/);
    expect(src).toMatch(/transparent: true/);
  });

  it("emits the default material (opaque) when there is no override", () => {
    const p = withNodes(emptyProject(), [meshMatNode()], ["m1"]);
    const src = generateSceneModule({ project: p }).sceneModuleSource;
    expect(src).toMatch(/color: "#cccccc"/);
    expect(src).toMatch(/transparent: false/);
  });
});

function meshNodeWith(id: string, behaviors: BehaviorBinding[]): SceneNode {
  return {
    id,
    name: id,
    type: "mesh",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", asset_id: "missing" },
    behaviors,
    user_data: {},
  };
}

function stubBehaviorEmitter(): (
  binding: BehaviorBinding,
  ctx: CodegenContext,
) => string {
  return (binding, ctx) => {
    if (!binding.enabled) return "";
    if (binding.behavior_type === "unknown-future") {
      ctx.warnings.push(`unknown behavior_type "${binding.behavior_type}" — skipped`);
      return "";
    }
    return `{ tickers.push((dt) => { ${ctx.currentNodeVar}.rotation.y += dt; }); }`;
  };
}

describe("scene-codegen behaviors integration", () => {
  it("emits tickers array in prolog and includes it in the epilog return", () => {
    const p = withNodes(emptyProject(), [meshNodeWith("n1", [])], ["n1"]);
    const out = generateSceneModule({
      project: p,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).toContain("const tickers = [];");
    expect(out.sceneModuleSource).toContain(
      "return { scene, camera, templates, tickers, interactions };",
    );
  });

  it("emits behavior code for enabled bindings", () => {
    const p = withNodes(
      emptyProject(),
      [
        meshNodeWith("n1", [
          {
            id: "b1",
            behavior_type: "auto-rotate",
            enabled: true,
            parameters: { axis: "y", speed: 30 },
          },
        ]),
      ],
      ["n1"],
    );
    const out = generateSceneModule({
      project: p,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).toContain("tickers.push");
  });

  it("skips disabled bindings", () => {
    const p = withNodes(
      emptyProject(),
      [
        meshNodeWith("n1", [
          {
            id: "b1",
            behavior_type: "auto-rotate",
            enabled: false,
            parameters: { axis: "y", speed: 30 },
          },
        ]),
      ],
      ["n1"],
    );
    const out = generateSceneModule({
      project: p,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });

  it("pushes a warning for unknown behavior_type", () => {
    const p = withNodes(
      emptyProject(),
      [
        meshNodeWith("n1", [
          {
            id: "b1",
            behavior_type: "unknown-future",
            enabled: true,
            parameters: {},
          },
        ]),
      ],
      ["n1"],
    );
    const out = generateSceneModule({
      project: p,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    expect(out.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`unknown behavior_type "unknown-future"`),
      ]),
    );
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });

  it("emits multiple bindings without var collisions (block scoping)", () => {
    const p = withNodes(
      emptyProject(),
      [
        meshNodeWith("n1", [
          {
            id: "b1",
            behavior_type: "auto-rotate",
            enabled: true,
            parameters: { axis: "y", speed: 30 },
          },
          {
            id: "b2",
            behavior_type: "auto-rotate",
            enabled: true,
            parameters: { axis: "x", speed: 15 },
          },
        ]),
      ],
      ["n1"],
    );
    const out = generateSceneModule({
      project: p,
      generateBehaviorCode: stubBehaviorEmitter(),
    });
    const pushes = out.sceneModuleSource.match(/tickers\.push/g) ?? [];
    expect(pushes.length).toBe(2);
  });

  it("legacy callers without generateBehaviorCode still produce a valid module", () => {
    const p = withNodes(
      emptyProject(),
      [
        meshNodeWith("n1", [
          {
            id: "b1",
            behavior_type: "auto-rotate",
            enabled: true,
            parameters: { axis: "y", speed: 30 },
          },
        ]),
      ],
      ["n1"],
    );
    const out = generateSceneModule({ project: p });
    expect(out.sceneModuleSource).toContain("const tickers = [];");
    expect(out.sceneModuleSource).not.toContain("tickers.push");
  });
});
