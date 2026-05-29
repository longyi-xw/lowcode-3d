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

Sections §4–§10 land in the next commits.
