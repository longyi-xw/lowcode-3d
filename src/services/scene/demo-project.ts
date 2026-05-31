import { generateUUID } from "@/core/id/uuid";
import { createDefaultProject } from "@/core/scene/defaults";
import type { RuntimeTarget, SceneNode, SceneProject } from "@/core/scene/types";

export const TARGET: RuntimeTarget = {
  kind: "three.js",
  version: "0.184.0",
  module_format: "esm",
};

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

/**
 * Builds a fresh SceneProject with a small, hand-authored scene that exercises
 * every NodeKind ThreeAdapter currently supports: one mesh inside a parent
 * group, one directional + one ambient light, and a grid helper. The parent
 * group (`models-group` → `cube-1`) is intentional — Phase 1 B's hierarchy
 * tree needs at least one parent/child relationship to verify nesting.
 *
 * Backs the "Starter scene" template (id `starter`) in the New-project
 * picker. Distinct from the example fixture in two ways:
 *   - The project id and timestamps are generated at call time so each run is
 *     a fresh project rather than a stale fixture.
 *   - Node ids are slugged ("cube-1", "models-group", …) rather than uuid-
 *     based, so the hierarchy panel reads naturally in MVP.
 */
export function createDemoProject(name = "Untitled project"): SceneProject {
  const base = createDefaultProject({
    id: generateUUID(),
    name,
    target: TARGET,
  });

  const nodes: Record<string, SceneNode> = {
    "grid-helper": {
      id: "grid-helper",
      name: "Grid",
      type: "helper",
      transform: IDENTITY,
      parent_id: null,
      children_ids: [],
      visible: true,
      // `locked: false` on disk — the runtime treats every helper as
      // effectively locked via `isEffectivelyLocked` regardless of this
      // value, so older project files keep working without a migration.
      locked: false,
      data: { type: "helper", helper_kind: "grid" },
      behaviors: [],
      user_data: {},
    },
    "models-group": {
      id: "models-group",
      name: "Models",
      type: "group",
      transform: IDENTITY,
      parent_id: null,
      children_ids: ["cube-1"],
      visible: true,
      locked: false,
      data: { type: "group" },
      behaviors: [],
      user_data: {},
    },
    "cube-1": {
      id: "cube-1",
      name: "Cube",
      type: "mesh",
      transform: { ...IDENTITY, position: [0, 0.5, 0] },
      parent_id: "models-group",
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "mesh", asset_id: "asset-cube" },
      behaviors: [],
      user_data: {},
    },
    "key-light": {
      id: "key-light",
      name: "Key Light",
      type: "light",
      transform: { ...IDENTITY, position: [3, 5, 3] },
      parent_id: null,
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
    "fill-light": {
      id: "fill-light",
      name: "Fill",
      type: "light",
      transform: IDENTITY,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "light",
        light_kind: "ambient",
        color: "#404040",
        intensity: 0.6,
      },
      behaviors: [],
      user_data: {},
    },
  };

  return {
    ...base,
    metadata: {
      ...base.metadata,
      name,
    },
    scene: {
      nodes,
      root_node_ids: ["grid-helper", "models-group", "key-light", "fill-light"],
    },
    assets: [
      {
        id: "asset-cube",
        content_hash: "sha256-cube-placeholder",
        kind: "geometry",
        relative_path: "assets/cube.glb",
        tags: ["primitive", "cube"],
        description: "Placeholder unit cube",
        source: { kind: "builtin", library_id: "primitives" },
      },
    ],
  };
}
