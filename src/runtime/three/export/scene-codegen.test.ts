import { describe, expect, it } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import type {
  AssetReference,
  RuntimeTarget,
  SceneNode,
  SceneProject,
} from "@/core/scene/types";

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
    expect(out.sceneModuleSource).toMatch(/return \{ scene, camera, templates \};/);
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
