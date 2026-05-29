# Scene Graph Specification

> **spec_version**: `0.1.0`
> **Status**: in sync with `src/core/scene/schemas.ts` as of 2026-05-29.
> **Relation to architecture**: `design/framework/architecture.md` §3 defines
> the high-level concepts; this file is the canonical schema authority for
> third-party adapter authors. When the two disagree, this file wins.

## 1. Overview

A **Scene Graph** is a technology-stack independent JSON description of a
3D scene. It is the on-disk format produced by the lowcode-3d editor and
consumed by any compliant runtime adapter (Three.js shipped; Babylon.js,
react-three-fiber, Unity planned).

Design tenets:

- **Tech-stack independent** — no engine-specific fields leak into the
  schema. Engine concerns live in adapter implementations (`docs/adapter-guide.md`).
- **Git-friendly** — every Node is its own file on disk; deterministic
  field ordering; quaternion / float arrays kept exact.
- **Forward-compatible** — every project carries a `spec_version`; unknown
  `behavior_type` / `node.type=custom` are preserved verbatim on load.
- **Validation up front** — zod schemas in `src/core/scene/schemas.ts` are
  the runtime source of truth; this document mirrors them.

A `SceneProject` is the top-level object. It contains a `SceneGraph` (the
node tree), an array of `AssetReference`s (deduplicated geometry/texture
references), and project-wide `settings`.

## 2. SceneProject (top-level)

### 2.1 Type

```ts
interface SceneProject {
  spec_version: "0.1.0";
  metadata: {
    id: string; // UUID v4
    name: string;
    created_at: string; // ISO 8601
    updated_at: string; // ISO 8601
    target_runtime: RuntimeTarget;
  };
  scene: SceneGraph;
  assets: AssetReference[];
  settings: {
    units: "meters" | "centimeters";
    up_axis: "y" | "z";
    background: ColorOrHDRI;
  };
}

type RuntimeTarget =
  | { kind: "three.js"; version: string; module_format: "esm" | "cjs" }
  | { kind: "babylon.js"; version: string } // reserved
  | { kind: "unity"; version: string; render_pipeline: "urp" | "hdrp" | "builtin" } // reserved
  | { kind: "react-three-fiber"; version: string }; // reserved

type ColorOrHDRI =
  | { kind: "color"; color: string }
  | { kind: "hdri"; asset_id: string };
```

> **Reserved targets** (babylon.js, unity, react-three-fiber): the schema
> accepts them, but no adapter currently implements them. The editor only
> lets the user create `three.js` projects in v0.1.

### 2.2 JSON example

A minimal single-cube project (from `examples/single-cube/project.json`,
trimmed for clarity):

```json
{
  "spec_version": "0.1.0",
  "metadata": {
    "id": "00000000-0000-4000-8000-000000000002",
    "name": "single-cube",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "target_runtime": {
      "kind": "three.js",
      "version": "0.164.0",
      "module_format": "esm"
    }
  },
  "scene": {
    "root_node_ids": ["cube-1"],
    "nodes": {
      "cube-1": {
        /* …Node… */
      }
    }
  },
  "assets": [],
  "settings": {
    "units": "meters",
    "up_axis": "y",
    "background": { "kind": "color", "color": "#101418" }
  }
}
```

For the on-disk folder layout (multiple files), see §8 Serialization.

### 2.3 Field reference

| Field                                | Type                        | Required | Notes                                                      |
| ------------------------------------ | --------------------------- | -------- | ---------------------------------------------------------- |
| `spec_version`                       | string literal `"0.1.0"`    | yes      | Bump on breaking changes; see §9.                          |
| `metadata.id`                        | UUID v4                     | yes      | Stable identity across saves.                              |
| `metadata.name`                      | string                      | yes      | Derived from folder name; do not author manually.          |
| `metadata.created_at` / `updated_at` | ISO 8601                    | yes      | Editor refreshes `updated_at` on every mutation.           |
| `metadata.target_runtime`            | `RuntimeTarget`             | yes      | Chosen at project creation; immutable thereafter.          |
| `scene`                              | `SceneGraph`                | yes      | See §3.                                                    |
| `assets`                             | `AssetReference[]`          | yes      | Deduplicated by content hash; see §5.                      |
| `settings.units`                     | `"meters" \| "centimeters"` | yes      | Editor uses for grid spacing and gizmo labels.             |
| `settings.up_axis`                   | `"y" \| "z"`                | yes      | Three.js convention is `"y"`.                              |
| `settings.background`                | `ColorOrHDRI`               | yes      | Adapter renders this; falls back to opaque black if unset. |

## 3. SceneGraph & Node

### 3.1 SceneGraph

```ts
interface SceneGraph {
  root_node_ids: string[]; // top-level nodes (order matters for render layering)
  nodes: Record<string, Node>; // flat map, keyed by node.id for O(1) lookup
}
```

The graph is **flat-with-parent-pointers** in memory (and in the unsplit
JSON example), not a recursive tree. This is intentional: random-access
lookup by id is O(1) and parent/child mutations don't have to walk a
recursive structure. The on-disk format splits `nodes` further into per-id
files (§8) but the in-memory shape is the same.

### 3.2 Node

```ts
interface Node {
  id: string; // UUID v4, globally unique
  name: string; // user-visible label
  type: NodeKind;
  transform: Transform;
  parent_id: string | null; // null = root
  children_ids: string[]; // ordered
  visible: boolean;
  locked: boolean; // helpers are always locked regardless (§4.5)
  data: NodeData; // discriminated union; see §4
  behaviors: BehaviorBinding[]; // see §6
  user_data: Record<string, unknown>; // free-form (AI annotations, tags, etc.)
}

type NodeKind =
  | "group"
  | "mesh"
  | "light"
  | "camera"
  | "helper"
  | "prefab_instance"
  | "custom";
```

> **TS naming note**: in `src/core/scene/types.ts` the TS type is
> `SceneNode` (and `NodeKind` for the enum) to avoid clashing with the
> `lib.dom` `Node` global. **On-disk field names are unchanged** — the
> JSON still says `"type": "mesh"`, etc.

### 3.3 Transform

```ts
interface Transform {
  position: [number, number, number]; // local-space, parent-relative
  rotation: [number, number, number, number]; // quaternion [x, y, z, w]
  scale: [number, number, number];
}
```

**Quaternion convention**: `[x, y, z, w]` order. This matches glTF 2.0 and
Three.js. Editors that display Euler angles (e.g. the lowcode-3d
properties panel) convert at the UI boundary only; the on-disk format
stays quaternion to avoid gimbal-lock ambiguity.

Identity transform:

```json
{ "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] }
```

## 7. Settings

```ts
interface Settings {
  units: "meters" | "centimeters";
  up_axis: "y" | "z";
  background: ColorOrHDRI;
}
```

- **`units`**: affects grid spacing, gizmo numeric labels, and exported
  scene scale. Default `"meters"`.
- **`up_axis`**: world up. Default `"y"` (Three.js / glTF convention).
  Adapters must honour this when computing camera framing.
- **`background`**: color (`{ "kind": "color", "color": "#RRGGBB" }`) or
  HDRI (`{ "kind": "hdri", "asset_id": "<uuid>" }`). HDRI requires the
  referenced asset to exist in `assets[]` and be `kind: "hdri"`.

Sections §4 NodeData per kind, §5 AssetReference, §6 BehaviorBinding,
§8 Serialization, §9 Versioning, §10 Validation, §11 Reserved are populated
in subsequent commits within this PR.
