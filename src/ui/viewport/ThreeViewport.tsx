import { useEffect, useRef } from "react";

import { AddNodeCommand } from "@/core/command/commands/add-node";
import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { isEffectivelyLocked } from "@/core/scene/policy";
import { dropPositionFor } from "@/lib/drop-helpers";
import { ThreeAdapter } from "@/runtime/three/adapter";
import { describeTemplate } from "@/runtime/three/asset-cache";
import { ThreeRenderHost } from "@/runtime/three/render-host";
import { captureTransform } from "@/runtime/three/transform-util";
import type {
  AssetReference,
  SceneNode,
  SceneProject,
  Transform,
} from "@/core/scene/types";
import { useAssetPreviewStore } from "@/services/assets/preview-store";
import { executeCommand } from "@/services/command-history";
import { findLibraryItem } from "@/services/library/catalog";
import { useProjectStore } from "@/services/project/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { computeFocusTarget } from "./focus-helpers";
import { diffSceneNodes } from "./scene-diff";

/**
 * Three.js viewport — thin shell over `ThreeRenderHost` (v1.0 B3a / B4b). The
 * host owns the WebGLRenderer, post-processing/outline, OrbitControls,
 * TransformControls (gizmo), the render loop, and the socket-marker overlay
 * (moved host-side in B4b — the component only calls host.syncSocketMarkers()
 * after scene diffs and selection changes). This component wires
 * `useSceneStore` / `useUIStore` / `useProjectStore` into the host and keeps
 * the remaining engine-specific extras: asset drag-drop, click-to-pick, and
 * play/pause behavior ticking.
 *
 * Lifecycle:
 *   - Mount effect re-runs only when the active project id changes (or goes
 *     null↔non-null). Editing a transform of an existing node does NOT
 *     re-create the host, so OrbitControls keeps the user's camera state.
 *   - Inside the mount effect we subscribe to useSceneStore for fine-grained
 *     scene changes and translate them into `syncNode("update"/"add"/"remove")`
 *     on the live adapter (via `diffAndApply`). We also subscribe to
 *     useUIStore for selection + gizmo-mode + play-state changes.
 *   - TransformControls drags emit one SetNodeTransformCommand each on
 *     mouseUp — never on objectChange — so a continuous drag is one undo
 *     entry rather than many. Mid-drag the Object3D moves freely without
 *     a round-trip through the scene store. The host owns this; the shell
 *     only registers the commit sink via `onTransformCommit`.
 *   - On unmount / project switch: dispose the host, unsubscribe from
 *     stores, remove the canvas + pointer listeners.
 *
 * Component-level WebGL tests are deferred to E2E because jsdom has no WebGL;
 * ThreeAdapter (the layer doing the actual work) is unit-covered separately.
 */
export function ThreeViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Mount-effect-owned host surfaced as a ref so cross-effect consumers
  // (currently the focus watch effect) can reach the live ThreeRenderHost
  // without forcing it to live as React state. Mutated only inside the
  // mount effect (set on construct, cleared on cleanup).
  const hostRef = useRef<ThreeRenderHost | null>(null);
  const projectId = useSceneStore((s) => s.project?.metadata.id ?? null);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const pendingFocusNodeId = useUIStore((s) => s.pendingFocusNodeId);
  const consumeFocusRequest = useUIStore((s) => s.consumeFocusRequest);

  useEffect(() => {
    if (!projectId) return;
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const host = new ThreeRenderHost();
    host.mount(canvas);
    hostRef.current = host;
    const adapter = host.adapter;

    adapter.assetCache.setProjectPath(useProjectStore.getState().currentPath);

    const initial = useSceneStore.getState().project;
    const seeded = initial ? seedScene(adapter, initial) : Promise.resolve();

    host.onTransformCommit((id, prev, next) => {
      executeCommand(
        new SetNodeTransformCommand({
          node_id: id,
          transform: next,
          prev_transform: prev,
        }),
      );
    });

    host.setSnapProvider(() => {
      const nodes = useSceneStore.getState().project?.scene.nodes ?? {};
      return Object.values(nodes).map((n) => ({
        id: n.id,
        sockets: n.sockets ?? [],
        visible: n.visible,
        type: n.type,
      }));
    });

    // syncSelectionShell wires selection into the host (gizmo target + outline)
    // and rebuilds socket markers (which depend on the current selection for
    // marker colour). Locked nodes: host.setGizmoTarget(id, true) detaches the
    // gizmo while host.setSelection(id) still outlines — same as the old
    // syncSelection's "locked → detach but still outline" behaviour. Missing
    // runtime object: both host methods no-op to detach/clear when
    // getRuntimeObject returns undefined, matching the old "obj not found"
    // branch.
    const syncSelectionShell = (id: string | null) => {
      const node = id ? useSceneStore.getState().project?.scene.nodes[id] : undefined;
      host.setGizmoTarget(id, node ? isEffectivelyLocked(node) : false);
      host.setSelection(id);
      host.syncSocketMarkers();
    };
    syncSelectionShell(useUIStore.getState().selectedNodeId);
    // seedScene is async, so when the viewport mounts while a selection is
    // already in the store (engine switch back to Three, v1.0 B1) the sync
    // above ran against an empty adapter and was a no-op. Re-picking the same
    // node won't re-fire the store subscription (same id == no change), so
    // without this replay the gizmo/outline stay missing until the selection
    // actually changes.
    let unmounted = false;
    void seeded.then(() => {
      if (unmounted) return;
      syncSelectionShell(useUIStore.getState().selectedNodeId);
    });

    // Distinguish a real click from the click event that browsers dispatch
    // after a drag (mouseup + mousedown on the same element fire a click
    // regardless of distance travelled). Without this guard, releasing a
    // gizmo or orbit drag inside the canvas runs pickAt at the release point
    // and hijacks the selection — most painfully onto the grid helper which
    // covers the whole floor plane.
    const DRAG_PX_TOLERANCE_SQ = 25; // 5px
    let downX = 0;
    let downY = 0;
    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const onClick = (event: MouseEvent) => {
      // Play mode: behaviors are running; clicking should not change the
      // selection / gizmo target. The Properties + Behaviors panels stay
      // locked to whatever was selected at the moment Play was pressed.
      if (useUIStore.getState().playState === "play") return;
      const dx = event.clientX - downX;
      const dy = event.clientY - downY;
      if (dx * dx + dy * dy > DRAG_PX_TOLERANCE_SQ) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setSelectedNodeId(adapter.pickAt(x, y));
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);

    // Asset drag-drop: a library-card drag activates assetDragItemId (see
    // services/library/asset-drag.ts). On release inside the canvas, raycast
    // the y=0 ground plane and add the item there (falling back to the item's
    // default position when the ray misses — camera facing the sky). Released
    // outside the canvas or on a miss-with-no-item we still clear the drag.
    // Bound on window (not canvas) so a release a few px past the canvas edge
    // is still caught.
    const onAssetDrop = (event: PointerEvent) => {
      const id = useUIStore.getState().assetDragItemId;
      if (!id) return; // not an asset drag
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      if (inside) {
        const uploads = useSceneStore.getState().project?.assets ?? [];
        const item = findLibraryItem(id, uploads);
        if (item) {
          const node = item.makeNode();
          const hit = adapter.raycastGroundPoint(x, y);
          if (hit) {
            node.transform.position = dropPositionFor(node.transform.position, hit);
          }
          executeCommand(new AddNodeCommand({ node }));
          setSelectedNodeId(node.id);
        }
      }
      useUIStore.getState().endAssetDrag(); // clear whether dropped in/out
    };
    window.addEventListener("pointerup", onAssetDrop);

    // ── Play / Pause side effects ─────────────────────────────────
    // transformSnapshots captures every Object3D's transform at the moment
    // Play is pressed so Pause can restore them — otherwise the cube would
    // stay frozen at whatever rotation the behavior happened to be at when
    // the user paused, instead of returning to the authored value.
    const transformSnapshots = new Map<string, Transform>();
    let playing = false;

    const enterPlay = () => {
      const project = useSceneStore.getState().project;
      if (!project) return;
      transformSnapshots.clear();
      for (const node of Object.values(project.scene.nodes)) {
        const obj = adapter.getRuntimeObject(node.id);
        if (obj) transformSnapshots.set(node.id, captureTransform(obj));
        if (node.behaviors.length > 0) {
          adapter.installBehaviors(node.id, node.behaviors);
        }
      }
      host.setGizmoTarget(null, false);
      host.setSelection(null);
      playing = true;
    };

    const exitPlay = () => {
      playing = false;
      const project = useSceneStore.getState().project;
      if (project) {
        for (const node of Object.values(project.scene.nodes)) {
          adapter.uninstallBehaviors(node.id);
        }
      }
      for (const [nodeId, t] of transformSnapshots) {
        const obj = adapter.getRuntimeObject(nodeId);
        if (!obj) continue;
        obj.position.fromArray(t.position);
        obj.quaternion.fromArray(t.rotation);
        obj.scale.fromArray(t.scale);
      }
      transformSnapshots.clear();
      syncSelectionShell(useUIStore.getState().selectedNodeId);
    };

    host.setFrameCallback((dt) => {
      if (playing) adapter.tickBehaviors(dt);
    });

    const resize = () => {
      host.resize(container.clientWidth, container.clientHeight);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const unsubscribeScene = useSceneStore.subscribe((state, prev) => {
      const next = state.project;
      const old = prev.project;
      if (!next || !old) return;
      if (next === old) return;
      if (next.metadata.id !== old.metadata.id) return; // handled by effect re-run
      void diffAndApply(adapter, old, next, host);
      host.syncSocketMarkers();
    });

    const unsubscribeProject = useProjectStore.subscribe((state, prev) => {
      if (state.currentPath !== prev.currentPath) {
        adapter.assetCache.setProjectPath(state.currentPath);
      }
    });

    const unsubscribeUI = useUIStore.subscribe((state, prev) => {
      if (state.selectedNodeId !== prev.selectedNodeId) {
        syncSelectionShell(state.selectedNodeId);
      }
      if (state.gizmoMode !== prev.gizmoMode) {
        host.setGizmoMode(state.gizmoMode);
      }
      if (state.playState !== prev.playState) {
        if (state.playState === "play") enterPlay();
        else exitPlay();
      }
    });

    host.start();

    return () => {
      unmounted = true;
      unsubscribeScene();
      unsubscribeProject();
      unsubscribeUI();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onAssetDrop);
      ro.disconnect();
      host.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      hostRef.current = null;
    };
  }, [projectId, setSelectedNodeId]);

  // Focus watch effect — listens for useUIStore.requestFocus calls and moves
  // the camera + orbit target so the requested node (or the scene origin when
  // id is null) sits centered at a fitting distance. Lives outside the mount
  // effect so it stays subscribed across re-renders without rebuilding the
  // renderer chain. Consumes the request (sets it back to undefined) so the
  // same request never fires twice.
  useEffect(() => {
    if (pendingFocusNodeId === undefined) return;
    const host = hostRef.current;
    if (!host) {
      consumeFocusRequest();
      return;
    }
    const obj =
      pendingFocusNodeId === null
        ? null
        : (host.adapter.getRuntimeObject(pendingFocusNodeId) ?? null);
    const { target, distance } = computeFocusTarget(obj);
    host.focusCamera(target, distance);
    consumeFocusRequest();
  }, [pendingFocusNodeId, consumeFocusRequest]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}

/**
 * Preload every glTF asset referenced by the project. Awaiting these before
 * seeding nodes means prefab_instance builders hit the cache at build time
 * and skip the placeholder path. Failures are tolerated — the cache records
 * the error, the node still renders as a magenta placeholder, and the UI
 * can surface the per-asset status when we add an asset panel.
 */
async function preloadAssets(
  adapter: ThreeAdapter,
  project: SceneProject,
): Promise<void> {
  const used = new Set<string>();
  for (const node of Object.values(project.scene.nodes)) {
    if (node.data.type === "prefab_instance") used.add(node.data.asset_id);
  }
  const tasks: Promise<unknown>[] = [];
  for (const asset of project.assets) {
    if (!used.has(asset.id)) continue;
    tasks.push(syncAndPublishPreview(adapter, asset as AssetReference));
  }
  await Promise.all(tasks);
}

/**
 * Load the asset, then publish a names-only preview tree to the asset
 * preview store so the hierarchy panel can render an expanded prefab_instance
 * without reaching into the runtime adapter. Skips publishing on failure —
 * the hierarchy panel falls back to a "loading…" placeholder row.
 */
async function syncAndPublishPreview(
  adapter: ThreeAdapter,
  asset: AssetReference,
): Promise<void> {
  await adapter.syncAsset(asset);
  const status = adapter.assetCache.get(asset.id);
  if (status.status !== "ready") return;
  const tree = describeTemplate(status.template);
  useAssetPreviewStore.getState().setTree(asset.id, tree);
}

/**
 * BFS-walk the project so parents are added before their children — required
 * because ThreeAdapter.syncNode("add") refuses to attach a child whose parent
 * is not yet registered. Async because we preload referenced assets first.
 */
async function seedScene(adapter: ThreeAdapter, project: SceneProject): Promise<void> {
  await preloadAssets(adapter, project);
  const queue: string[] = [...project.scene.root_node_ids];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node: SceneNode | undefined = project.scene.nodes[id];
    if (!node) continue;
    adapter.syncNode(node, "add");
    queue.push(...node.children_ids);
  }
}

/**
 * Translate node-identity differences between two project snapshots into
 * syncNode calls via the engine-neutral diffSceneNodes walk (adds are
 * BFS-ordered so parents land first; removes detach the gizmo / clear the
 * outline before the object disappears).
 *
 * Async because newly-added prefab_instance nodes may reference an asset
 * not yet in the cache; we kick off syncAsset for any unknown asset_ids
 * surfaced in the diff so the rebuild path picks them up.
 */
async function diffAndApply(
  adapter: ThreeAdapter,
  old: SceneProject,
  next: SceneProject,
  host: ThreeRenderHost,
): Promise<void> {
  // Preload any assets that are new in `next` but absent from `old` —
  // typically a fresh import. Doing this BEFORE the node walk means the
  // prefab_instance builder runs with the template already cached, so the
  // placeholder path is skipped on the happy path.
  const oldAssetIds = new Set(old.assets.map((a) => a.id));
  const newAssets = next.assets.filter((a) => !oldAssetIds.has(a.id));
  if (newAssets.length > 0) {
    await Promise.all(
      newAssets.map((a) => syncAndPublishPreview(adapter, a as AssetReference)),
    );
  }
  const diff = diffSceneNodes(old.scene, next.scene);
  for (const n of diff.added) adapter.syncNode(n, "add");
  for (const n of diff.updated) adapter.syncNode(n, "update");
  for (const n of diff.removed) {
    if (useUIStore.getState().selectedNodeId === n.id) {
      host.setGizmoTarget(null, false);
      host.setSelection(null);
    }
    adapter.syncNode(n, "remove");
  }
}
