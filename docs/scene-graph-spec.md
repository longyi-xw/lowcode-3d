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

## 4. NodeData per kind

`Node.data` is a discriminated union keyed by `data.type`, which must
match the parent `Node.type` (the zod schema enforces this with a
`refine`). Each `NodeKind` has its own schema; below each subsection
lists the schema, a JSON example, and the current ThreeAdapter support
matrix.

> **ThreeAdapter support matrix legend**: `Implemented` = builder exists
> in `src/runtime/three/node-builders/`; `Codegen` = exported by
> `scene-codegen.ts` to standalone code; `Limitations` = known current
> gaps with file pointer where applicable.

### 4.1 `group`

```ts
type GroupData = { type: "group" };
```

A pure organizational container. No render output; its `transform` still
affects descendants.

```json
{
  "id": "models-group",
  "name": "Models",
  "type": "group",
  "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": ["cube-1"],
  "visible": true,
  "locked": false,
  "data": { "type": "group" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                 | Codegen | Limitations |
| --------------------------- | ------- | ----------- |
| ✅ `node-builders/group.ts` | ✅      | None        |

### 4.2 `mesh`

```ts
interface MeshData {
  type: "mesh";
  asset_id: string; // references AssetReference (geometry kind)
  material_overrides?: MaterialOverride[]; // applied slot-by-slot at render time
}

interface MaterialOverride {
  slot: number; // material slot index (non-negative int)
  color?: string; // #RRGGBB or #RRGGBBAA
  metalness?: number; // 0..1
  roughness?: number; // 0..1
  opacity?: number; // 0..1
  emissive?: string; // #RRGGBB or #RRGGBBAA
  emissive_intensity?: number; // ≥ 0
}
```

Renders the referenced geometry asset. `material_overrides` lets a node
tweak PBR parameters on top of the cached material; the ThreeAdapter
currently applies only the first entry (`[0]`). The v0.2 material editor
will surface a full multi-slot UI.

```json
{
  "id": "cube-1",
  "name": "Cube",
  "type": "mesh",
  "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": { "type": "mesh", "asset_id": "asset-cube" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                | Codegen | Limitations                                                                                                                                                                       |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ `node-builders/mesh.ts` | ✅      | Only `material_overrides[0]` applied (single-slot); full multi-slot PBR editor deferred to v0.2; builder ships placeholder `BoxGeometry` until `syncAsset` swaps in real geometry |

### 4.3 `light`

```ts
interface LightData {
  type: "light";
  light_kind: "directional" | "point" | "spot" | "ambient";
  color: string; // #RRGGBB or #RRGGBBAA
  intensity: number; // ≥ 0; three.js Light intensity units
  distance?: number; // point / spot only; ≥ 0 (0 = infinite)
  decay?: number; // point / spot only; ≥ 0 (three.js default 2)
  angle?: number; // spot only; radians
  penumbra?: number; // spot only; 0..1
  cast_shadow?: boolean; // applied to all kinds except ambient
}
```

```json
{
  "id": "key-light",
  "name": "Key Light",
  "type": "light",
  "transform": { "position": [3, 5, 3], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": {
    "type": "light",
    "light_kind": "directional",
    "color": "#ffffff",
    "intensity": 1.2,
    "cast_shadow": true
  },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                               | Codegen | Limitations                                                                                                |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| ✅ `node-builders/light.ts` (all 4 kinds) | ✅      | `cast_shadow` toggled but shadow map size / bias not yet authorable; no light-map / IES / area-light kinds |

### 4.4 `camera`

```ts
interface CameraData {
  type: "camera";
  camera_kind: "perspective" | "orthographic";
  fov?: number; // perspective, degrees
  aspect?: number; // perspective, ratio
  near: number; // > 0
  far: number; // > 0
  left?: number; // orthographic frustum
  right?: number; // orthographic frustum
  top?: number; // orthographic frustum
  bottom?: number; // orthographic frustum
}
```

```json
{
  "id": "main-camera",
  "name": "Main Camera",
  "type": "camera",
  "transform": { "position": [4, 3, 4], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": {
    "type": "camera",
    "camera_kind": "perspective",
    "fov": 50,
    "near": 0.1,
    "far": 1000
  },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                               | Codegen | Limitations                                                                                                                                                              |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ `node-builders/camera.ts` (both kinds) | ✅      | Editor viewport camera is separate; scene cameras are placeable but not yet switchable at runtime; no `aperture` / `focus_distance` (depth of field — reserved for v0.2) |

### 4.5 `helper`

```ts
interface HelperData {
  type: "helper";
  helper_kind: string; // current: "grid" | "axes" (unknown kinds render as empty Object3D)
}
```

Editor-only visual aids. **Helpers are always effectively locked and
always raycast-unpickable**, regardless of the `Node.locked` field — see
`src/core/scene/policy.ts` `isEffectivelyLocked()` (returns `true` for
every `helper` node) and `src/runtime/three/node-builders/helper.ts`
(stubs `raycast` to a no-op for the entire subtree). Helpers are filtered
out by `scene-codegen.ts` so they don't leak into exported runtimes.

```json
{
  "id": "grid-helper",
  "name": "Grid",
  "type": "helper",
  "transform": { "position": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": { "type": "helper", "helper_kind": "grid" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                                   | Codegen          | Limitations                                                                                                           |
| --------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| ✅ `node-builders/helper.ts` (`grid`, `axes`) | ❌ (editor-only) | Unknown `helper_kind` values render as empty `Object3D` (not an error); helper-kind registry is not pluggable in v0.1 |

### 4.6 `prefab_instance`

```ts
interface PrefabInstanceData {
  type: "prefab_instance";
  asset_id: string; // references an AssetReference with kind="geometry" (.glb)
}
```

A leaf node in the SceneGraph that materialises a cached `.glb` subtree
at runtime. The geometry subtree itself is **not** part of the
SceneGraph — only the reference and the instance transform are. The
ThreeAdapter clones the cached template (`AssetCache.cloneTemplate`,
sharing geometry & materials) per instance; when the asset hasn't loaded
yet the builder drops in a translucent magenta placeholder `BoxGeometry`
and stamps `userData.assetId` so a later `syncAsset` call can swap in
the real subtree. See `docs/adapter-guide.md` §4.6 for the runtime cache
model.

```json
{
  "id": "boombox-instance",
  "name": "BoomBox",
  "type": "prefab_instance",
  "transform": { "position": [0, 1, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1] },
  "parent_id": null,
  "children_ids": [],
  "visible": true,
  "locked": false,
  "data": { "type": "prefab_instance", "asset_id": "asset-boombox-sha256" },
  "behaviors": [],
  "user_data": {}
}
```

| Implemented                           | Codegen | Limitations                                                                              |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| ✅ `node-builders/prefab-instance.ts` | ✅      | No per-instance material overrides yet; no Unpack Prefab command (deferred to Prefab v2) |

### 4.7 `custom`

```ts
interface CustomData {
  type: "custom";
  custom_type: string; // adapter-specific identifier
  payload: unknown; // schema is the adapter's responsibility
}
```

Extension point for adapter-specific nodes the schema doesn't model.
Editors should round-trip `custom` nodes verbatim. The ThreeAdapter does
**not** register a default builder: see
`src/runtime/three/node-builders/index.ts`, where the dispatch throws
`ThreeAdapter: "custom" node type "<custom_type>" has no registered builder`.
Third-party adapters that want graceful degradation should register a
fallback builder that emits an empty group plus a warning.

| Implemented                                                    | Codegen | Limitations                                                                               |
| -------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| 🟡 Round-trip preserved on disk; ThreeAdapter throws on render | 🟡      | No `custom_type` registered in v0.1; reserved as extension point for third-party adapters |

## 5. AssetReference

```ts
interface AssetReference {
  id: string; // UUID v4
  content_hash: string; // sha256 of the file bytes (hex, lowercase)
  kind: "geometry" | "texture" | "hdri" | "audio" | "video";
  relative_path: string; // "assets/{content_hash}.{ext}", relative to project root
  tags: string[];
  description: string;
  source: AssetSource;
}

type AssetSource =
  | { kind: "builtin"; library_id: string }
  | { kind: "user_upload"; original_filename: string }
  | { kind: "online"; provider: string; url: string; license: string }
  | { kind: "ai_generated"; model: string; prompt: string };
```

**Content-addressed storage**: the bytes for every asset live at
`{project}/assets/{content_hash}.{ext}`. The hash is computed Rust-side
during import (`src-tauri/src/assets.rs`, `sha256_hex`) and is the source
of identity — re-importing identical bytes returns the existing
`AssetReference` (no duplication). Cross-save persistence uses
**hardlinks** (with byte-copy fallback) so the atomic-swap save flow
doesn't orphan assets — see `src-tauri/src/project_io.rs`
(`preserve_subdir`).

**Original filename** is preserved in `source.original_filename` for
`user_upload` so the editor can render a human-readable label even though
the on-disk file is hash-named.

The runtime `AssetCache` (a per-`ThreeAdapter` in-memory `Map<asset_id,
THREE.Group>`) is not part of the spec — it belongs to adapter
implementation, covered in `docs/adapter-guide.md` §4.6.

## 6. BehaviorBinding

```ts
interface BehaviorBinding {
  id: string; // UUID v4, unique within the node
  behavior_type: string; // e.g. "auto-rotate"
  enabled: boolean;
  parameters: Record<string, unknown>; // schema is per behavior_type
}
```

Behaviors are **semantic actions** that cross technology stacks. The
spec only describes the binding shape; the parameter schema is owned by
each `behavior_type`. Adapters implement (and emit code for) each
behavior they support. Unknown `behavior_type`s on load are preserved
verbatim and marked unknown at runtime — they are not dropped.

### 6.1 Built-in behaviors (v0.1)

| `behavior_type` | Parameters                                                    | Description                                                                                    |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `auto-rotate`   | `{ axis: "x" \| "y" \| "z"; speed: number }` (speed in deg/s) | Rotates the node around a local axis at the given speed during Play mode and in exported code. |

Source of truth: `src/runtime/three/behaviors/auto-rotate.ts`
(`ParamsSchema`). The runtime tick multiplies `speed * (π / 180) * dt`
each frame; the codegen emitter precomputes the same `Math.PI / 180`
factor so exported standalone projects match Play-mode behaviour
exactly.

#### `auto-rotate` example

```json
{
  "id": "b1",
  "behavior_type": "auto-rotate",
  "enabled": true,
  "parameters": { "axis": "y", "speed": 30 }
}
```

### 6.2 Adapter responsibilities

For each supported `behavior_type`, an adapter must:

1. Register a `Behavior` class with the adapter's `behaviorRegistry`
2. Implement `install(node, params)` → `tick(handle, dt)` → `uninstall(handle)`
3. Provide `generateCode(binding, ctx)` for the codegen pipeline (so
   exported projects re-run the behavior in the standalone runtime)

See `docs/adapter-guide.md` §5 for the full Behavior class contract.

### 6.3 Forward-compat: unknown behaviors

When loading a project, the editor preserves any `behavior_type` it
doesn't recognise. The runtime marks the binding with `__unknown: true`
and skips its `install`/`tick`/`generateCode` calls. Save round-trips
without loss; the binding becomes active again if a future adapter ships
support.

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

## 8. Serialization (on-disk)

A SceneProject is stored as a **folder**, not a single file. This makes
git diffs minimal when only one node changes.

### 8.1 Folder layout

```
my-project.lowcode/
├── project.json                 # SceneProject minus scene (kept in scene/)
├── scene/
│   ├── hierarchy.json           # root_node_ids + parent→children adjacency
│   └── nodes/
│       ├── cube-1.json          # one file per node, named by Node.id
│       └── …
├── assets/
│   ├── {content_hash}.glb       # one file per asset, content-addressed
│   └── …
└── .lowcode/                    # local-only caches (thumbnails, indexes); gitignored
```

Implementation: `src/core/scene/persistence.ts` (pure, browser-side
serializer) plus `src-tauri/src/project_io.rs` (atomic disk I/O).

### 8.2 `project.json` (no scene field)

The top-level `SceneProject` with the entire `scene` field **removed** —
both the per-node objects and `scene.root_node_ids` live under `scene/`.
The persisted shape is `Omit<SceneProject, "scene">`:

```json
{
  "spec_version": "0.1.0",
  "metadata": { "id": "…", "name": "single-cube", "...": "..." },
  "assets": [],
  "settings": { "...": "..." }
}
```

### 8.3 `scene/hierarchy.json`

A flat `root_node_ids` array plus a **sparse** `parent → child[]`
adjacency map (entries for empty children lists are omitted). The
loader derives each node's `parent_id` from this table:

```json
{
  "root_node_ids": ["grid-helper", "models-group", "key-light", "fill-light"],
  "children": {
    "models-group": ["cube-1"]
  }
}
```

### 8.4 `scene/nodes/{id}.json`

One file per node. The on-disk body is the `Node` object with **both
`parent_id` and `children_ids` removed** (`Omit<SceneNode, "parent_id" |
"children_ids">`) — those are owned by `hierarchy.json` so moving a node
dirties only the hierarchy file, not the moved node's body or either
parent's file.

### 8.5 Folder naming

Saving to `foo.lowcode/` (or `foo.project/`) implies project
`metadata.name = "foo"`. The editor strips the `.lowcode` / `.project`
suffix on save / open and refuses to author a different `metadata.name`
than the basename.

Node `id` values are also used as filenames, so they must be filesystem
safe — `persistence.ts` rejects ids matching `[\\/:*?"<>|\s]` at
serialize time.

### 8.6 `.lowcode/` local caches

Editor-side thumbnails and indexes live under `.lowcode/`. Project
authors should `.gitignore` this folder — it's local-only and
regenerable.

### 8.7 Atomic save

The save flow (`src-tauri/src/project_io.rs::save_folder`) writes a
sibling `.{stem}.lowcode-tmp-{ts}/` directory, then renames it onto the
target. If a previous version exists it is first moved to
`.{stem}.lowcode-bak-{ts}/` for rollback, then removed once the new
directory is in place. Assets under `assets/` are preserved across the
swap by per-file hardlink (byte-copy fallback when the filesystem
rejects hardlinks, e.g. cross-fs).

## 9. Versioning & Migration

The `spec_version` is **semver-shaped** but its bumps follow these rules:

- **Patch bump (0.1.x)**: clarifications, new optional fields, new
  enum members (additive). Loaders for an older patch must accept newer
  patch files (forward-compat for additions).
- **Minor bump (0.x.0)**: breaking field renames, removed enum members,
  format changes that require migration. A migration function in
  `src/core/migrations/{from}-to-{to}.ts` must exist before merge.
- **Major bump (x.0.0)**: incompatible scope changes (e.g. a new
  on-disk container format). Reserved for v1.0.

Loading flow:

1. Parse `project.json`
2. Read `spec_version`
3. If `spec_version` < current, run all chained migrations in
   `src/core/migrations/`
4. Validate against the current zod schema (§10)

No migration is needed for v0.1.0 → v0.1.0; this section is the contract
for v0.2+ work.

## 10. Validation

Runtime source of truth: `src/core/scene/schemas.ts` (zod schemas).

| Schema                  | Validates                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `SceneProjectSchema`    | top-level + metadata + settings                                  |
| `SceneGraphSchema`      | nodes graph + root_node_ids                                      |
| `SceneNodeSchema`       | individual Node (after `hierarchy.json` reattachment)            |
| `BehaviorBindingSchema` | each binding's `id` / `behavior_type` / `enabled` / `parameters` |
| `AssetReferenceSchema`  | per-asset entry                                                  |

Editors should validate on every save (refuse to write if the project
doesn't round-trip) and on every load (refuse to open if the file is
malformed). The loader returns a typed `PersistenceError` discriminated
by `missing_file` / `json_syntax` / `hierarchy` / `schema` so the UI can
surface actionable error messages.

## 11. Reserved & Future

The schema accepts but currently does nothing with:

- `RuntimeTarget` kinds other than `three.js` (`babylon.js`, `unity`,
  `react-three-fiber` — v1.0+ work).
- `MeshData.material_overrides` (v0.2 — PBR material editor).
- `BehaviorBinding.behavior_type` values beyond the v0.1 built-ins —
  preserved round-trip (§6.3) and ready for v0.5 Stage C
  (hover-highlight, click-trigger, event-emit, etc.).
- `Node.user_data` — AI-annotation freezone; the editor does not
  introspect.

Anticipated v0.2+ fields:

- `MaterialOverride` schema (PBR parameters per instance)
- `CameraData.aperture` / `focus_distance` (depth of field)
- `Settings.shadow_quality` / `Settings.tone_mapping`

When these land, `spec_version` bumps per §9 and the section moves out
of Reserved.
