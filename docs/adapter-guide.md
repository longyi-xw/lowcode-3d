# Runtime Adapter Authoring Guide

> **Status**: in sync with `src/runtime/adapter.ts` and
> `src/runtime/three/adapter.ts` as of 2026-05-29.
>
> **Relation to other docs**:
>
> - `design/framework/architecture.md` §4.1 introduces the concept at a
>   high level.
> - `docs/scene-graph-spec.md` is the data format authority — this guide
>   does not redefine fields, only describes the engine mapping.
> - When this guide and `architecture.md` disagree on interface details,
>   this guide wins.

## 1. What is a runtime adapter

A **runtime adapter** is the bridge between the technology-independent
Scene Graph (`docs/scene-graph-spec.md`) and a concrete rendering /
game engine (Three.js shipped; Babylon.js, react-three-fiber, Unity
planned). It is the only place engine-specific knowledge lives.

Conceptually:

```
[SceneGraph (tech-neutral JSON)]
           │
           ▼
  IRuntimeAdapter.syncNode("add" / "update" / "remove")
           │
           ▼
   [THREE.Scene / Babylon.Scene / …]
```

The five-layer architecture places adapters in `src/runtime/`, depending
**only** on `src/core/` (Scene Graph types + Command interface) — never
on `src/editor/`, `src/services/`, or `src/ui/`. This keeps adapters
embeddable from non-editor contexts (e.g. a CLI export pipeline) and
prevents UI churn from rippling into the runtime.

The MVP ships **only the Three.js adapter** (`src/runtime/three/`).
`RuntimeTarget.kind` values other than `"three.js"` are reserved in the
spec but have no adapter implementation in v0.1.

## 2. The `IRuntimeAdapter` interface

The contract every adapter must satisfy is intentionally minimal — just
enough to keep the live editor and the export pipeline working. Source
of truth: `src/runtime/adapter.ts`.

```ts
interface IRuntimeAdapter {
  readonly target: RuntimeTarget;

  // ── Editor sync ─────────────────────────────────────────────────
  syncNode(node: SceneNode, op: SyncOp): void;
  syncAsset(asset: AssetReference): Promise<void>;
  getRuntimeObject(node_id: string): unknown;
  pickAt(screen_x: number, screen_y: number): string | null;

  // ── Export ──────────────────────────────────────────────────────
  exportProject(project: SceneProject, options: ExportOptions): Promise<ExportResult>;

  // ── Behaviors ───────────────────────────────────────────────────
  getSupportedBehaviors(): BehaviorDefinition[];
  generateBehaviorCode(binding: BehaviorBinding, context: CodegenContext): string;
}

type SyncOp = "add" | "update" | "remove";
```

### 2.1 Method contracts

| Method                               | Inputs                                   | Outputs / side effects                                                                                 | Errors                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target` (readonly)                  | —                                        | `RuntimeTarget` literal the adapter targets (kind + version + module_format)                           | —                                                                                                                                                                 |
| `syncNode(node, op)`                 | One Scene Graph Node + an op             | Adds / updates / removes the engine object; the ThreeAdapter also caches a `nodeSnapshot` for rebuilds | `add` throws if the node already exists, or if its `parent_id` references a node it doesn't know about. `update` throws on unknown id. `remove` is idempotent.    |
| `syncAsset(asset)`                   | One `AssetReference`                     | Loads bytes (or pulls from cache); refreshes any prefab placeholders that referenced the asset         | Rejects on IO / parse error; the ThreeAdapter currently swallows non-ready cache statuses so the editor keeps rendering and surfaces errors via the cache status. |
| `getRuntimeObject(id)`               | Node id                                  | The engine-specific object or `null`/`undefined`; declared `unknown` so engine types don't leak        | —                                                                                                                                                                 |
| `pickAt(x, y)`                       | CSS pixel coords                         | Hit `SceneNode.id` or `null` (walks up the engine parent chain to find the nearest tagged ancestor)    | Returns `null` when the viewport size is unset or the ray hits empty space                                                                                        |
| `exportProject(project, options)`    | Whole project + target options           | `ExportResult` (`Map<path, ExportFile>` + warnings); dispatches on `options.target`                    | Throws when no emitter is registered for the requested target                                                                                                     |
| `getSupportedBehaviors()`            | —                                        | List of `BehaviorDefinition` (type id + parameter schema + display name + description)                 | —                                                                                                                                                                 |
| `generateBehaviorCode(binding, ctx)` | One `BehaviorBinding` + `CodegenContext` | JS source string to splice into the exported `main.js`; mutates `ctx.warnings` on skip                 | Disabled / unknown / invalid-params bindings return `""` and push a warning rather than throwing                                                                  |

### 2.2 Adapter-private extensions (live editor only)

The Three.js adapter ships a few methods that are **not** part of
`IRuntimeAdapter` because they only make sense inside the live editor
host. They are not required for an export-only adapter (e.g. a future
CLI exporter); the editor wires them up explicitly:

| Method                                | Purpose                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `setViewportSize(width, height)`      | Receives the host's CSS pixel size on every `ResizeObserver` tick so `pickAt` can compute NDC.    |
| `installBehaviors(node_id, bindings)` | Resolves each binding against the adapter's `behaviorRegistry` and stores per-binding handles.    |
| `tickBehaviors(dt)`                   | Drives every active handle once per RAF frame; per-binding throws are caught and logged.          |
| `uninstallBehaviors(node_id)`         | Disposes all handles installed against the node id. Idempotent.                                   |
| `dispose()`                           | Drops Three.js handles, clears caches, and uninstalls every active behavior. Call before discard. |

The viewport host also owns the `THREE.WebGLRenderer`, the
`OrbitControls`, the `EffectComposer` / `OutlinePass`, and the
`TransformControls` gizmo — the adapter only exposes its `scene` and
`camera`. This split keeps the adapter usable without a DOM, which is
how `src/runtime/three/adapter.test.ts` exercises it in jsdom.

### 2.3 The behavior trio is recent (v0.5 Stage A)

`installBehaviors` / `tickBehaviors` / `uninstallBehaviors` landed in
PR #20 (commit `5d45571` — "feat(adapter): live-runtime behavior
install/tick/uninstall"). Earlier adapter drafts did not have them; they
replace what would otherwise have been a hand-rolled "mutate
`object3D.rotation` each tick" loop inside the viewport.

The Stage A design guarantees the same `Behavior` instance is used by
editor preview (`install` → `tick` → `uninstall`) and by codegen
(`generateCode`) — see §5 when it lands.

Note that the behavior trio is **not** declared on `IRuntimeAdapter`
itself; the interface only mandates `getSupportedBehaviors` and
`generateBehaviorCode` (the codegen half). Live preview is a host
concern, and a non-Three adapter that ships only an exporter would not
need to implement the trio at all.

## 3. Lifecycle

A typical editor session goes through these stages. The Three.js
adapter is driven by the React `useEffect` block at the top of
`src/ui/viewport/ThreeViewport.tsx`; other hosts (a CLI exporter, a
headless test) drive the same calls without the DOM bits.

1. **Construct + attach canvas** — the viewport host does
   `const adapter = new ThreeAdapter();`, creates a
   `THREE.WebGLRenderer`, and appends `renderer.domElement` to its
   container. There is no `adapter.mount()` method — the adapter only
   owns the `scene` and `camera`; rendering, controls, and DOM
   ownership stay in the host.

2. **Initial sync** — `seedScene(adapter, project)` BFS-walks the
   project so parents are added before children:
   `await preloadAssets(...)` issues `adapter.syncAsset(asset)` for
   every glTF referenced by a `prefab_instance` node, then each node is
   passed to `adapter.syncNode(node, "add")` in BFS order. See
   `seedScene` / `preloadAssets` in `ThreeViewport.tsx`.

3. **Edit loop** — Scene Graph mutations (gizmo drags, command-history
   undo/redo, property panel edits) cause `useSceneStore` to publish a
   new `SceneProject` snapshot. The viewport subscribes and runs
   `diffAndApply(adapter, old, next, gizmo, outlinePass)` which fires
   the appropriate `adapter.syncNode(node, "update" | "add" | "remove")`
   calls, detaches the gizmo from any node about to disappear, and
   kicks off `syncAsset` for any newly-referenced asset.

4. **Pick** — `pointerdown` records the down position; the matching
   `click` event (filtered against a 5px drag tolerance so an orbit /
   gizmo drag inside the canvas doesn't fire a pick) calls
   `adapter.pickAt(x, y)`. The returned id is fed into
   `useUIStore.setSelectedNodeId`, which in turn drives the gizmo
   attach and the outline pass. See `docs/scene-graph-spec.md` §3.2 for
   node identity rules.

5. **Play mode side effects** — when `useUIStore.playState` transitions
   to `"play"` (PR #21, commit `b6b6883`):
   - For every node in the project, `adapter.installBehaviors(node.id,
node.behaviors)` is called and the node's current
     `Object3D.position/quaternion/scale` is captured into a
     `transformSnapshots` map so Pause can restore it later.
   - The transform gizmo is detached
     (`gizmo.detach(); outlinePass.selectedObjects = []`) so the
     selection rectangle doesn't follow a rotating cube.
   - The click handler bails out early (`if
(useUIStore.getState().playState === "play") return;`) so picking
     is bypassed during play.
   - The RAF loop sets `playClock = new THREE.Clock()` and on every
     frame calls `adapter.tickBehaviors(playClock.getDelta())`.
   - The command-history stack is frozen while play is active (commit
     `60d2314` — "feat(command-history): freeze stack in play mode")
     so users can't poison the undo history with transient transform
     values.

   On transition back to `"pause"`, the host calls
   `adapter.uninstallBehaviors(node.id)` for every node, restores
   `Object3D.position/quaternion/scale` from `transformSnapshots`, and
   re-syncs the selection (re-attaching the gizmo).

6. **Export** — `adapter.exportProject(project, options)` returns
   `ExportResult { files, warnings }`; the host writes the files via
   the Rust side (`src-tauri/`). The same `generateBehaviorCode` used
   above is bound in as the codegen hook so the exported `main.js`
   ticks behaviors identically to the editor preview.

7. **Unmount** — the React effect's cleanup runs in this order:
   `cancelAnimationFrame(rafId)` → unsubscribe from all stores →
   remove DOM listeners and resize observer → `gizmo.detach()` +
   `gizmo.dispose()` → `orbit.dispose()` → `composer.dispose()` →
   `renderer.dispose()` → remove the `<canvas>` from the container →
   `adapter.dispose()` (drops every Three.js handle, clears caches,
   uninstalls any still-active behaviors).

**Asset preloading order**: assets must be `syncAsset`'d **before** any
node that references them is `syncNode("add")`'d. The `seedScene` and
`diffAndApply` helpers in `ThreeViewport.tsx` enforce this order; the
`prefab_instance` builder's magenta placeholder cube exists only for the
race where a load fails or runs concurrently — see
`docs/scene-graph-spec.md` §4.6 for the runtime cache model.

## 4. Mapping Node kinds to engine objects

Adapters dispatch on `Node.type` via a `BuilderRegistry`. The shape in
`src/runtime/three/node-builders/index.ts` is:

```ts
interface NodeBuilder {
  build(node: SceneNode): THREE.Object3D;
  update(object: THREE.Object3D, node: SceneNode): void;
}

interface BuilderRegistry {
  selectBuilder(node: SceneNode): NodeBuilder;
}

// Free helpers callers actually use:
function buildObject(registry: BuilderRegistry, node: SceneNode): THREE.Object3D;
function updateObject(
  registry: BuilderRegistry,
  object: THREE.Object3D,
  node: SceneNode,
): void;
```

The registry is **created per adapter instance** via
`createBuilderRegistry({ prefabInstance })`. That parameter is the
stateful prefab-instance builder, produced by
`createPrefabInstanceBuilder(assetCache)` so it can close over the
adapter's `AssetCache`. Every other per-kind builder
(`group.ts`, `mesh.ts`, `light.ts`, `camera.ts`, `helper.ts`) is a
stateless module exporting `build` / `update`, imported as a namespace
and reused across all adapter instances.

`buildObject` / `updateObject` are pure dispatch wrappers — they call
`registry.selectBuilder(node)` then forward to the builder's
`build` / `update`. Transforms, `visible`, `userData.nodeId`, and
`userData.locked` are applied at the adapter layer (`applyTransform` /
`applyMeta` in the same file), not by individual builders.

### 4.1 group → `THREE.Group`

Pure container. The builder constructs a `THREE.Group`, sets `name`,
and is a no-op on `update`. Transform + visibility are applied by the
adapter (`applyTransform`, `applyMeta`).

### 4.2 mesh → `THREE.Mesh`

The MVP mesh builder echoes a placeholder cube
(`BoxGeometry(1,1,1)` + `MeshStandardMaterial` with `color: 0xcccccc`,
`metalness: 0`, `roughness: 0.7`) and stamps `data.asset_id` onto
`userData.assetId`. The first entry of `data.material_overrides` is
applied if present (color, metalness, roughness, opacity, emissive,
emissive_intensity); additional entries are ignored in v0.1 because
hand-authored multi-material meshes route through `prefab_instance`
instead. See `docs/scene-graph-spec.md` §4.2 for the field definition.

### 4.3 light → `THREE.{Directional|Point|Spot|Ambient}Light`

`data.light_kind` dispatches to the matching Three.js light. `intensity`
passes through unchanged; `color` is parsed as a `THREE.Color`.
`distance` / `decay` are honoured for point + spot, `angle` / `penumbra`
for spot only, `cast_shadow` for everything except ambient. See
`docs/scene-graph-spec.md` §4.3.

### 4.4 camera → `THREE.{Perspective|Orthographic}Camera`

`data.camera_kind` dispatches. Scene cameras are placeable but do
**not** become the active editor camera — the editor uses its own
camera owned by the viewport host (driven by OrbitControls). Picking up
the first authored camera as the runtime camera is currently an
export-time concern only (`emitCamera` writes `camera = <varName>;` so
the exported `main.js` uses it). See `docs/scene-graph-spec.md` §4.4.

### 4.5 helper → `THREE.GridHelper` / `THREE.AxesHelper`

The builder constructs the helper subtree and immediately walks it,
replacing every `Object3D.raycast` with a no-op. This opts the whole
subtree out of viewport raycasting — `pickAt` never resolves to a grid
line, even when the helper is translated in front of geometry (a real
problem for `GridHelper`, which is a `LineSegments` whose default
line-proximity raycast would otherwise grab any click near a grid
line). Selection via the hierarchy panel still works because that path
doesn't go through raycast. Helpers are **effectively locked** (see
§4.8) regardless of `Node.locked`, and they are **not emitted** by
codegen (§6.3).

### 4.6 prefab_instance → cached `THREE.Group` clone

The `.glb` template is loaded once into the `AssetCache` (per
`ThreeAdapter`; the cache lives in `src/runtime/three/asset-cache.ts`).
Each `prefab_instance` node gets a `template.clone(true)` whose
geometry and materials are shared with the template — 50 instances =
50 leaf nodes + 1 template (Unity / PlayCanvas Prefab model).

**Always `syncAsset` before `syncNode("add")` for a prefab_instance.**
If the cache lookup misses at `build` time, the builder drops a
**magenta `MeshStandardMaterial` placeholder cube** in place (`color:
0xff00ff`, `opacity: 0.6`, `transparent: true`) tagged
`userData.prefabPlaceholder = true`. The adapter scans those
placeholders inside `syncAsset` and rebuilds them in place once the
template lands, so the scene keeps rendering through the race.

See `docs/scene-graph-spec.md` §4.6 for the runtime cache model.

### 4.7 custom

The default builder throws on `data.type === "custom"`. Adapters that
support custom nodes should subclass / wrap the registry and resolve
via `data.custom_type`. Spec round-trip (preserve on load + save) is
required even for unrecognised custom types — see
`docs/scene-graph-spec.md` §4.7.

### 4.8 Pickability and locking

Two cross-cutting policies in `src/core/scene/policy.ts` must be
honoured by every adapter:

- **`isEffectivelyLocked(node)`** returns `true` for helpers regardless
  of `node.locked` and otherwise returns `node.locked` verbatim. The
  editor uses this to skip gizmo attach and grey out property inputs;
  adapters should treat it as the authority and never reach for
  `node.locked` directly.
- **Raycast skipping** for helper subtrees (see §4.5). Adapters with
  their own picking strategy (e.g. engine-side hit testing) must apply
  the same skip rules.

## 5. Mapping Behaviors

### 5.1 The `Behavior` class

The ThreeAdapter's contract in `src/runtime/three/behaviors/types.ts`:

```ts
interface BehaviorHandle {
  dispose?(): void;
}

interface Behavior<TParams = unknown> {
  readonly definition: BehaviorDefinition;

  install(object: THREE.Object3D, params: TParams): BehaviorHandle;
  tick(
    object: THREE.Object3D,
    params: TParams,
    handle: BehaviorHandle,
    dt: number,
  ): void;

  /** Returns a code block whose lines start at column 0; the
   *  scene-codegen caller prefixes each line with the current indent. */
  emit(varName: string, params: TParams, ctx: CodegenContext): string;
}
```

Notes worth flagging up front:

- `Behavior` implementations are stateless. All per-binding runtime
  state belongs in the `BehaviorHandle` returned by `install`, so a
  single `Behavior` instance can serve many bindings (Flyweight).
- The handle is a structural type: `dispose` is optional. Behaviors
  with no resources to release (e.g. `auto-rotate`) can return `{}` and
  uninstall is a no-op for them.
- There is no `uninstall(handle, ctx)` method on the class — the
  adapter calls `handle.dispose?.()` directly during
  `uninstallBehaviors`. The Behavior class itself only owns
  `install` / `tick` / `emit`. (`docs/scene-graph-spec.md` §6.2
  describes the per-binding flow using the older `install` /
  `tick` / `uninstall` triplet; what is implemented today is the
  handle-disposable variant described here.)
- `emit` returns a string of generated code; the adapter's
  `generateBehaviorCode` (declared on `IRuntimeAdapter`) handles
  binding lookup, schema validation, and warning collection, then
  calls `emit(ctx.currentNodeVar, parsed.data, ctx)`.

### 5.2 Registry

Each adapter owns a `ThreeBehaviorRegistry`
(`src/runtime/three/behaviors/registry.ts`) — a thin
`Map<behavior_type, Behavior>` with `register` / `get` / `list`.
`createThreeBehaviorRegistry()` (in
`src/runtime/three/behaviors/index.ts`) returns a registry
pre-populated with the v0.1 catalog (just `AutoRotateBehavior` today);
the ThreeAdapter calls it in its constructor. Registering a new
behavior is one `r.register(...)` line in that factory plus the
implementation module.

### 5.3 The codegen ↔ runtime sharing rule

The same `Behavior` instance powers both:

1. **Editor Play mode**: `adapter.installBehaviors(nodeId, bindings)` →
   per-binding `handle = behavior.install(object, params)`;
   `adapter.tickBehaviors(dt)` →
   `behavior.tick(object, params, handle, dt)` once per RAF frame.
2. **Exported code**:
   `adapter.generateBehaviorCode(binding, ctx)` validates the binding
   against `behavior.definition.parameters_schema` and calls
   `behavior.emit(ctx.currentNodeVar, parsed, ctx)`; the returned
   string is spliced into the exported `scene.js` via `pushBlock` (the
   codegen helper that prefixes each line with the current indent).

This invariant — single `Behavior` class, two call sites — is what
guarantees the exported code behaves like the editor preview. Don't
fork the implementation.

### 5.4 Per-binding error isolation

If `install` / `tick` throws for one binding, the adapter must **not**
abort the others. `ThreeAdapter.installBehaviors` wraps each `install`
call in `try / catch` and logs via `console.error`; `tickBehaviors`
does the same per binding inside the per-node loop; `uninstallBehaviors`
wraps `handle.dispose?.()`. The test
`src/runtime/three/adapter.test.ts` ("tick errors on one binding don't
break others") is a placeholder today — it only exercises uninstall
because `behaviorRegistry` is private and there's only one shipped
behavior. Real coverage lands when a second stateful behavior is
written (v0.5 Stage C).

### 5.5 The auto-rotate example

Reference implementation: `src/runtime/three/behaviors/auto-rotate.ts`.
Parameter schema (zod):

```ts
const ParamsSchema = z.object({
  axis: z.enum(["x", "y", "z"]),
  speed: z.number(), // degrees per second
});
```

- `install(object, params)`: returns `{}` — there's no per-binding
  state to track. Auto-rotate is purely additive on
  `object.rotation[axis]`, so install / uninstall don't need to capture
  or restore the original rotation.
- `tick(object, params, _handle, dt)`: runs
  `object.rotation[params.axis] += params.speed * DEG2RAD * dt`
  where `DEG2RAD = Math.PI / 180` is a module-level constant.
- `emit(varName, params, _ctx)`: returns a `{ … }`-wrapped block that
  precomputes the same `Math.PI / 180` factor as a local `_omega` and
  pushes `(dt) => { ${varName}.rotation.${axis} += _omega * dt; }`
  onto the codegen prolog's `tickers` array, which the emitter's
  `main.js` animate loop drains every frame.

Restoring the original transform when Play stops is handled by the
viewport host (`ThreeViewport.tsx` captures a `transformSnapshots` map
on play and restores it on pause; see §3 step 5), **not** by the
behavior — uninstalling auto-rotate alone is a no-op.

## 6. Code export

The export contract in `src/runtime/adapter.ts`:

```ts
interface Exporter {
  readonly target: ExportTarget;
  emit(
    project: SceneProject,
    options: ExportOptions,
    generateBehaviorCode: (binding: BehaviorBinding, ctx: CodegenContext) => string,
  ): ExportResult;
}

interface ExportResult {
  files: Map<string, ExportFile>;
  warnings: string[];
}

type ExportFile =
  | { kind: "text"; content: string }
  | { kind: "asset_copy"; source_relative_path: string };

type ExportTarget = "vite" | "standalone-esm";

interface ExportOptions {
  target?: ExportTarget; // defaults to "vite" inside the adapter
  include_dev_comments?: boolean;
}
```

The `IRuntimeAdapter.exportProject(project, options): Promise<ExportResult>`
method dispatches on `options.target` via the per-adapter `EXPORTERS`
map (in `src/runtime/three/adapter.ts`) and forwards `project`,
`options`, and a bound `generateBehaviorCode` to the chosen `Exporter`.
Emitters themselves are synchronous today; the `Promise` wrapper is
forward-compat for targets that need to async-resolve metadata.

### 6.1 Text vs asset_copy

`ExportResult.files` is a single map keyed by destination-relative
path. Text files (`main.js`, `index.html`, `package.json`, `scene.js`,
…) carry their content inline as a UTF-8 string. Binary files (.glb
assets) are **references** (`asset_copy` with
`source_relative_path` resolved against the source project) — the Rust
side hardlinks them into the destination (falling back to byte copy on
cross-fs), avoiding a round-trip of multi-megabyte bytes through
JavaScript. See §6.4.

### 6.2 Built-in `Exporter`s

| Target             | Output                                                                                                                                            | Use case                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `"vite"`           | A Vite project (`package.json`, `vite.config.js`, `jsconfig.json`, `index.html`, `src/main.js`, `src/scene.js`, `README.md`, `assets/<hash>.glb`) | Production-ready, importable into existing Vite codebases       |
| `"standalone-esm"` | `index.html` (importmap → esm.sh for three.js + OrbitControls + GLTFLoader) + `main.js` + `scene.js` + `README.md` + `assets/<hash>.glb`          | Drop-in viewer, runs from `python -m http.server` / `npx serve` |

Both targets share the same `scene.js` body generated by
`src/runtime/three/export/scene-codegen.ts` — that module emits **plain
JS with JSDoc types**, asserted by
`src/runtime/three/export/scene-codegen.test.ts` (the "no TS syntax"
suite rejects `interface`, `: THREE.<…>` annotations,
`(expr) as Type` casts, and `new Promise<…>` generics — anything the
Standalone ESM target can't execute directly).

Adding a new target is one entry in `EXPORTERS`
(`src/runtime/three/adapter.ts`) plus one `Exporter` implementation
under `src/runtime/three/export/`.

### 6.3 What is and isn't emitted

**Emitted by `scene-codegen.ts`** (per-node):

- `group`, `mesh`, `light`, `camera`, `prefab_instance` (the
  `NODE_KINDS_EMITTED` set). `mesh` echoes the editor's placeholder
  cube and pushes a warning that hand-authored geometry export is not
  yet implemented; real geometry routes through `prefab_instance`. A
  prefab_instance referencing a missing `asset_id` falls back to an
  empty `THREE.Group` + a warning.
- Per-node `transform.position` / `quaternion` / `scale` and `visible`
  (only when `false`).
- Per-node `behaviors[]` via the injected `generateBehaviorCode` hook —
  any binding the adapter validates produces a block spliced after the
  `parent.add(node)` line.

**Emitted by the per-target `mainJs`** (Vite + Standalone ESM):

- `OrbitControls` wired against the runtime camera — unconditional, so
  the export feels interactive instead of a static image.
- A low-intensity (`0.3`) `AmbientLight(0xffffff, 0.3)` added to the
  built scene **unconditionally** (not only "when no authored lights
  exist") — the comment in `mainJs` is "fallback ambient so a scene
  with no lights still shows something". Authored lights stack on top
  of it.
- The animate loop drains `built.tickers` once per frame with
  `clock.getDelta()` so behavior `emit` blocks (which push lambdas onto
  `tickers` in the codegen prolog) run identically to the editor's
  `tickBehaviors`.

**Skipped (warning pushed by `scene-codegen.ts`)**:

- Helper nodes (grid / axes) — editor chrome only.
- `custom` nodes that fall outside `NODE_KINDS_EMITTED` (warning
  surfaces as "type X is editor chrome and not emitted in production
  exports").

**Skipped silently — editor-only host concerns, never reach codegen**:

- `TransformControls` selection gizmo, `OutlinePass` post-processing,
  `EffectComposer`, and any UI side effects. These live in
  `src/ui/viewport/ThreeViewport.tsx`, not in `src/runtime/`.

### 6.4 The Rust write side

`write_export_files` (`src-tauri/src/export.rs`) consumes an
`ExportPayload` whose shape mirrors `ExportResult.files` split into
`text_files: HashMap<String, String>` + `asset_copies: HashMap<String,
String>` (destination relative path → source-relative path under
`source_project_path`). It follows a stage-into-tmp →
`rename`-into-place → `bak` → cleanup atomic pattern (the same idea as
`save_project_folder` in `src-tauri/src/project_io.rs`), and it
**refuses to export inside the source project** via `is_inside()` —
which canonicalises both paths so macOS `/tmp` ↔ `/private/tmp` doesn't
defeat the check. Asset copies use `fs::hard_link` and fall back to
`fs::copy` when the destination filesystem rejects hardlinks (cross-fs,
exotic FS).

Adapters don't have to know about any of this — they just return the
`ExportResult` and the host (`src/services/...` plus `commands.write_export_files`)
wires the rest.

## 7. Writing your own adapter — step by step

> **Hypothetical code, not tested. Babylon.js 8.x API as of 2026-05.**
> The snippets below illustrate the wiring; they are not compiled or
> exercised against a real Babylon installation. Use them as a
> structural reference, not as copy-paste working code. Behavior method
> signatures match the real `Behavior` interface in
> `src/runtime/three/behaviors/types.ts` so the cross-engine port is
> mechanical.

We build a fictitious `BabylonAdapter` from scratch. The final layout
is `src/runtime/babylon/` (currently a reserved empty folder).

### 7.1 Step 1 — constructor + empty `syncNode`

`IRuntimeAdapter` has no `mount` / `unmount` (see §3): the viewport host
calls `new ThreeAdapter()` directly and owns the renderer / canvas
lifecycle. A Babylon adapter follows the same shape — accept the
`<canvas>` (or `RuntimeTarget`) at construction time, expose `dispose()`
for teardown.

```ts
// src/runtime/babylon/adapter.ts
import { ArcRotateCamera, Engine, Scene, Vector3 } from "@babylonjs/core";
import type { IRuntimeAdapter } from "@/runtime/adapter";
import type { RuntimeTarget, SceneNode } from "@/core/scene/types";

export class BabylonAdapter implements IRuntimeAdapter {
  readonly target: RuntimeTarget = {
    kind: "babylon.js",
    version: "8.0.0",
  } as const;
  private readonly engine: Engine;
  private readonly scene: Scene;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    new ArcRotateCamera(
      "editor-cam",
      -Math.PI / 2,
      Math.PI / 3,
      5,
      Vector3.Zero(),
      this.scene,
    );
    this.engine.runRenderLoop(() => this.scene.render());
  }

  syncNode(_node: SceneNode, _op: "add" | "update" | "remove"): void {
    /* TODO */
  }

  dispose(): void {
    this.engine.dispose();
  }
  // … remaining IRuntimeAdapter methods throw NotImplementedYet for now
}
```

**Acceptance for Step 1**: opening an empty project shows a Babylon
canvas with an `ArcRotateCamera`. Verify with a vitest test that
asserts `new BabylonAdapter(canvas)` creates an `Engine` and that
`dispose()` releases it.

### 7.2 Step 2 — per-kind builders via `BuilderRegistry`

Pattern: a `BuilderRegistry` analogous to the Three.js one in
`src/runtime/three/node-builders/index.ts`. The Three.js registry uses
free functions `buildObject(registry, node)` and `updateObject(registry,
object, node)` that dispatch via `selectBuilder(node)`. Mirror the
shape:

```ts
// src/runtime/babylon/node-builders/index.ts
import type { Scene, TransformNode } from "@babylonjs/core";
import type { SceneNode } from "@/core/scene/types";
import { buildMesh } from "./mesh";
import { buildLight } from "./light";
import { buildGroup } from "./group";
// …

export interface BabylonBuilderRegistry {
  buildObject(node: SceneNode): TransformNode;
  updateObject(object: TransformNode, node: SceneNode): void;
}

export function createBuilderRegistry(scene: Scene): BabylonBuilderRegistry {
  return {
    buildObject(node) {
      switch (node.type) {
        case "group":
          return buildGroup(scene, node);
        case "mesh":
          return buildMesh(scene, node);
        case "light":
          return buildLight(scene, node);
        /* … */
        default:
          throw new Error(`BabylonAdapter: no builder for type ${node.type}`);
      }
    },
    updateObject(object, node) {
      /* per-kind property re-apply */
    },
  };
}
```

Each per-kind file owns the engine mapping. For `mesh` you'd resolve
the geometry from `AssetCache` (Step 4) and create a Babylon
`AbstractMesh`. **Acceptance**: a project with one mesh + one light
renders in the Babylon canvas.

### 7.3 Step 3 — `pickAt`

Babylon ships hit testing out of the box:

```ts
pickAt(screen_x: number, screen_y: number): string | null {
  const pick = this.scene.pick(screen_x, screen_y);
  if (!pick?.hit || !pick.pickedMesh) return null;
  // Walk up to the nearest ancestor carrying a SceneNode.id, matching
  // the ThreeAdapter's findNodeId() walk (see adapter.ts).
  let current: TransformNode | null = pick.pickedMesh;
  while (current) {
    const id = current.metadata?.nodeId;
    if (typeof id === "string") return id;
    current = current.parent as TransformNode | null;
  }
  return null;
}
```

Stamp `node.id` into `mesh.metadata.nodeId` during build. Helpers (if
you add any) should be marked `mesh.isPickable = false` — the
equivalent of the ThreeAdapter's helper `raycast = () => {}` override.
**Acceptance**: clicking a mesh sets `useUIStore.selectedNodeId`.

### 7.4 Step 4 — `AssetCache` + `syncAsset`

Babylon's `SceneLoader.LoadAssetContainerAsync` loads .glb into a
container; you clone instances on demand. Mirror the ThreeAdapter
contract: `syncAsset` returns silently on recoverable errors (the cache
surfaces error state via its own API) so the editor stays usable.

```ts
private assetCache = new Map<string, AssetContainer>();

async syncAsset(asset: AssetReference): Promise<void> {
  if (this.assetCache.has(asset.id)) return;
  try {
    const container = await SceneLoader.LoadAssetContainerAsync(
      "", asset.relative_path, this.scene,
    );
    this.assetCache.set(asset.id, container);
  } catch (e) {
    /* record in cache; do not throw */
  }
}
```

**Acceptance**: a `prefab_instance` referencing a real .glb appears in
the viewport.

### 7.5 Step 5 — `behaviorRegistry` + auto-rotate port

The real `Behavior` interface (`src/runtime/three/behaviors/types.ts`):

```ts
interface Behavior<TParams = unknown> {
  readonly definition: BehaviorDefinition;
  install(object: EngineObject, params: TParams): BehaviorHandle;
  tick(object: EngineObject, params: TParams, handle: BehaviorHandle, dt: number): void;
  emit(varName: string, params: TParams, ctx: CodegenContext): string;
}
```

Note the shape: `install` receives the engine object directly (not the
`SceneNode`); `tick` receives the engine object **plus** the params
**plus** the handle **plus** `dt`; `emit` returns a code block whose
lines start at column 0 (the scene-codegen caller indents it). There
is no `uninstall` method — per-binding teardown belongs to
`BehaviorHandle.dispose?()`. Behaviors are stateless; per-binding state
goes on the handle (Flyweight). Transform restoration on Stop is the
viewport host's job (`transformSnapshots` in `ThreeViewport.tsx`), not
the behavior's.

Port `auto-rotate` to Babylon, keeping the parameter shape (`axis`,
`speed`):

```ts
// src/runtime/babylon/behaviors/auto-rotate.ts
import { Vector3, type TransformNode } from "@babylonjs/core";
import { z } from "zod";

import type { Behavior, BehaviorHandle } from "./types";
import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

const ParamsSchema = z.object({
  axis: z.enum(["x", "y", "z"]),
  speed: z.number(),
});
type Params = z.infer<typeof ParamsSchema>;

const DEG2RAD = Math.PI / 180;

export class AutoRotateBabylonBehavior implements Behavior<Params> {
  readonly definition: BehaviorDefinition = {
    type: "auto-rotate",
    name: "Auto Rotate",
    description: "Rotates the node around a local axis at a constant angular velocity.",
    parameters_schema: ParamsSchema,
  };

  install(_object: TransformNode, _params: Params): BehaviorHandle {
    return {};
  }

  tick(
    object: TransformNode,
    params: Params,
    _handle: BehaviorHandle,
    dt: number,
  ): void {
    const axis =
      params.axis === "x"
        ? Vector3.Right()
        : params.axis === "y"
          ? Vector3.Up()
          : Vector3.Forward();
    object.rotate(axis, params.speed * DEG2RAD * dt);
  }

  emit(varName: string, params: Params, _ctx: CodegenContext): string {
    // Same shape as the Three.js emit: open-brace block + tickers.push.
    // The Babylon main.js prolog has to declare `tickers = []` the same way.
    return [
      `{`,
      `  const _omega = ${params.speed} * Math.PI / 180;`,
      `  tickers.push((dt) => { ${varName}.rotate(BABYLON.Vector3.Up(), _omega * dt); });`,
      `}`,
    ].join("\n");
  }
}
```

Register the behavior with a Babylon-flavoured `behaviorRegistry`
(parallel to `createThreeBehaviorRegistry()` in
`src/runtime/three/behaviors/registry.ts`). The adapter's
`installBehaviors(nodeId, bindings)` / `tickBehaviors(dt)` /
`uninstallBehaviors(nodeId)` then look identical to the ThreeAdapter
implementation modulo the engine type. **Acceptance**: clicking Play
on a mesh with an auto-rotate binding rotates it in the Babylon viewport.

### 7.6 Step 6 — Wire into `useUIStore` + `RuntimeTarget`

Edit the project factory in `src/services/...` to allow
`RuntimeTarget.kind === "babylon.js"` when creating new projects
(currently the spec reserves it but the factory only emits `three.js`).
Add a `BabylonExporter` and register it in the adapter's `EXPORTERS`
map (the Three.js equivalent is the top-level constant in
`src/runtime/three/adapter.ts` — not `src/runtime/three/export/`).
Finally, change the viewport host (`ThreeViewport.tsx` or a sibling
`BabylonViewport.tsx`) to construct the right adapter based on
`project.metadata.target_runtime.kind`.

**Acceptance**: creating a new project with
`target_runtime.kind === "babylon.js"` boots the BabylonAdapter
instead of ThreeAdapter; all earlier acceptance tests still pass.

### Closing the loop

Run the visual smoke matrix in `docs/scene-graph-spec.md` examples
against your new adapter. Differences between adapters are expected
(e.g. light intensity units, default fallback ambient); document them
in a per-adapter README.

## 8. ThreeAdapter reference

A tour of `src/runtime/three/`:

```
src/runtime/three/
├── adapter.ts                    # ThreeAdapter implements IRuntimeAdapter
├── adapter.test.ts               # ThreeAdapter integration tests
├── asset-cache.ts                # per-adapter Map<asset_id, parsed glTF template>
├── index.ts                      # public re-exports
├── node-builders/
│   ├── index.ts                  # createBuilderRegistry + buildObject/updateObject dispatch
│   ├── group.ts
│   ├── mesh.ts                   # placeholder cube geometry + MeshStandardMaterial
│   ├── light.ts                  # directional / point / spot / ambient
│   ├── camera.ts                 # perspective / orthographic
│   ├── helper.ts                 # GridHelper + AxesHelper; raycast no-op
│   └── prefab-instance.ts        # AssetCache lookup + magenta placeholder
├── behaviors/
│   ├── index.ts                  # createThreeBehaviorRegistry export
│   ├── registry.ts               # ThreeBehaviorRegistry: Map<type, Behavior>
│   ├── registry.test.ts
│   ├── types.ts                  # Behavior + BehaviorHandle interfaces
│   ├── auto-rotate.ts            # reference Behavior implementation
│   └── auto-rotate.test.ts
└── export/
    ├── scene-codegen.ts          # SceneProject → scene.js (TS-syntax-free)
    ├── scene-codegen.test.ts     # includes the "no TS syntax" assertion suite
    ├── vite-emitter.ts           # Vite project template
    ├── standalone-esm-emitter.ts # importmap-based single-file viewer
    └── emitters.test.ts
```

Note that `EXPORTERS` (the `ExportTarget → Exporter` dispatch table)
lives at the top of `src/runtime/three/adapter.ts`, **not** in a
separate `export/adapter.ts`. Adding a new target = one entry in that
constant plus one `Exporter` implementation in `export/`.

### 8.1 Key design decisions (with PR pointers)

| Topic                                                                           | Where                                                | PR                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Editor layout + viewport click coords + canvas display style                    | `EditorView`, `ThreeViewport.tsx`, `adapter.ts`      | [#5](https://github.com/longyi-xw/lowcode-3d/pull/5)   |
| Bundle-chunking buckets (`vendor-three`, `vendor-three-addons`, `vendor-react`) | `vite.config.ts` `manualChunks`                      | [#9](https://github.com/longyi-xw/lowcode-3d/pull/9)   |
| `OutlinePass` selection (color, edgeStrength, dragging-changed listener)        | `ThreeViewport.tsx`                                  | [#11](https://github.com/longyi-xw/lowcode-3d/pull/11) |
| Helper raycast no-op (regression fix shipped alongside File menu PR)            | `node-builders/helper.ts`, `ThreeViewport.tsx`       | [#15](https://github.com/longyi-xw/lowcode-3d/pull/15) |
| `isEffectivelyLocked` policy (helper lockedness derived from type)              | `src/core/scene/policy.ts`                           | [#16](https://github.com/longyi-xw/lowcode-3d/pull/16) |
| `AssetCache` + content-hashed assets + hardlink persistence                     | `asset-cache.ts`, `prefab-instance.ts`, `src-tauri/` | [#17](https://github.com/longyi-xw/lowcode-3d/pull/17) |
| `scene-codegen.ts` plain-JS-with-JSDoc rule + Vite/Standalone emitters          | `scene-codegen.ts`, `scene-codegen.test.ts`          | [#19](https://github.com/longyi-xw/lowcode-3d/pull/19) |
| Behavior framework + ticker prolog/epilog in codegen (Stage A)                  | `behaviors/`, `scene-codegen.ts`                     | [#20](https://github.com/longyi-xw/lowcode-3d/pull/20) |
| Play mode side effects (gizmo detach, outline clear, pickAt bypass) (Stage B)   | `ThreeViewport.tsx`                                  | [#21](https://github.com/longyi-xw/lowcode-3d/pull/21) |

## 9. Testing your adapter

### 9.1 Current coverage

`src/runtime/three/adapter.test.ts` groups its assertions into the
following `describe` blocks:

- **`ThreeAdapter constructor`** — scene/camera defaults,
  `defaultCamera` overrides, canonical target fallback.
- **`ThreeAdapter.syncNode add path`** — group / child parenting /
  transform application / visibility propagation / duplicate-id throw /
  missing-parent throw / mesh / directional light / perspective camera /
  grid helper.
- **`ThreeAdapter.syncNode update path`** — transform re-apply,
  in-place light intensity update, throw on unknown id.
- **`ThreeAdapter.syncNode remove path`** — detach + free id, child
  detach without touching root, idempotent remove, mesh
  geometry/material dispose.
- **`ThreeAdapter.syncNode unsupported paths`** — `custom` throws.
- **`ThreeAdapter.pickAt`** — unset viewport degenerate case,
  centre-of-viewport hit, empty-space null, ancestor walk-up for child
  meshes, helper raycast skip regression test.
- **`ThreeAdapter shell methods still pending`** — `getRuntimeObject`
  undefined for unknown ids, `getSupportedBehaviors` non-empty,
  `syncAsset` surfaces `no_project_path` error in non-Tauri envs.
- **`ThreeAdapter prefab_instance + syncAsset`** — placeholder when
  uncached, clone at build time when preloaded, placeholder rebuild
  once `syncAsset` resolves.
- **`ThreeAdapter.dispose`** — clears scene + object map.
- **`ThreeAdapter behaviors`** — `getSupportedBehaviors` includes
  auto-rotate, `generateBehaviorCode` for enabled / disabled / unknown
  type / invalid params.
- **`ThreeAdapter live behavior runtime`** — `installBehaviors` +
  `tickBehaviors` advances rotation, `uninstallBehaviors` stops it,
  disabled / unknown / invalid bindings skipped without throwing,
  missing node is silent no-op, dispose releases handles.

The last group's `"tick errors on one binding don't break others"`
case is currently a placeholder — it only exercises uninstall today
because `behaviorRegistry` is private. A real version requires a
second stateful behavior to inject a throwing one (v0.5 Stage C work).

### 9.2 Codegen syntax assertions

`src/runtime/three/export/scene-codegen.test.ts` has an
`"emits no TypeScript-only syntax in the body"` test that rejects
emit containing the following patterns (each its own
`expect(src).not.toMatch(...)`):

- `\binterface\b` — no TS `interface` declarations
- `:\s*THREE\.` — no `: THREE.Foo` type annotations
- `\)\s+as\s+[A-Z]` — no `(expr) as Type` casts
- `new Promise<[^>]+>` — no generic arguments at call sites

The plain-JS-with-JSDoc guarantee is what lets the Standalone ESM
emitter serve `scene.js` verbatim from the browser without a build
step. If your codegen produces TS-only syntax these assertions fail.

### 9.3 Planned: conformance suite

A cross-adapter conformance suite is planned for **v1.0** alongside
the Babylon.js adapter. It will load a fixture SceneGraph, run it
through each adapter, and compare:

- Selection / `pickAt` behavior on the same screen coordinates
- Render-loop tick correctness for each built-in behavior
- Exported code parity (snapshot the same scene against each adapter
  and assert byte-equal `scene.js` modulo target-specific imports)

Until then, treat ThreeAdapter as the de-facto baseline.

## 10. Reserved & Future

### 10.1 Reserved `RuntimeTarget` kinds

- **`babylon.js`** — see the §7 walk-through. v1.0 work.
- **`unity`** — high-level: export to a Unity project skeleton +
  `.scene` file. Pre-spec.
- **`react-three-fiber`** — declarative R3F project export. Pre-spec.

The schema accepts all three (`docs/scene-graph-spec.md` §2.1 / §11),
but no adapter currently implements them. The editor only lets the
user create `three.js` projects in v0.1.

### 10.2 Multi-adapter scope

At runtime, exactly one adapter is mounted per editor session — the one
matching `project.metadata.target_runtime.kind`. At export time the
project is bound to its `target_runtime`; exporting cross-target is
**not** on the roadmap. The v1.0 conformance suite (§9.3) is the limit
of cross-adapter promises — same SceneGraph, parity in observable
output, not cross-target re-export.

### 10.3 AI Skill integration (v0.3)

`getRuntimeObject(node_id)` is the **single entry point** an AI Skill
will use to introspect the live engine state for "describe what's in
the scene" prompts. Adapters should keep it cheap (return the cached
`Object3D` / `AbstractMesh` directly; no subtree walk, no allocation).
The Skill framework (v0.3, see `docs/roadmap.md`) wraps this call so
the LLM sees a stable, engine-agnostic surface.

### 10.4 Asset preload conformance

A future addition to the `IRuntimeAdapter` contract:
`preloadAssets(assets: AssetReference[]): Promise<void>` for batch
parallel loading. Currently each `syncAsset` is serial and the
viewport host orders them before the matching `syncNode("add")` calls
(see §3 asset preload rule). Reserved for v0.2 work, when the asset
browser lands and batch import becomes a common path.
