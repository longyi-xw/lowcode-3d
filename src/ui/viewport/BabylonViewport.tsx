import { useEffect, useRef } from "react";

import { Vector3, Quaternion, type Node as BabylonNode } from "@babylonjs/core";

import { AddNodeCommand } from "@/core/command/commands/add-node";
import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { isEffectivelyLocked } from "@/core/scene/policy";
import type { SceneNode, Transform } from "@/core/scene/types";
import type { SyncOp } from "@/runtime/adapter";
import { BabylonRenderHost } from "@/runtime/babylon/render-host";
import { computeBabylonFocusTarget } from "@/runtime/babylon/focus-helpers";
import { captureTransform } from "@/runtime/babylon/transform-util";
import type { SnapNode } from "@/runtime/render-host";
import { executeCommand } from "@/services/command-history";
import { findLibraryItem } from "@/services/library/catalog";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";
import { dropPositionFor } from "@/lib/drop-helpers";

import { diffSceneNodes, EMPTY_SCENE_GRAPH, type SceneDiff } from "./scene-diff";

/**
 * Babylon.js viewport (v1.0 B1 — view + orbit camera only). Mirrors
 * ThreeViewport's lifecycle conventions:
 *   - Mount effect re-runs only when the active project id changes; node
 *     edits flow through a useSceneStore subscription → diffSceneNodes →
 *     adapter.syncNode, so the canvas / camera state survive edits.
 *   - No play / drop / focus — those are B4; gizmo landed in B3b; picking +
 *     selection highlight landed in B2. The surrounding UI disables itself via
 *     engineCapabilities.
 * Per-node sync failures warn + skip (one unbuildable node — e.g. a helper,
 * which has no Babylon builder yet — must not kill the whole viewport).
 */
export function BabylonViewport({
  createHost,
}: {
  /** Test seam — defaults to a real-Engine host. */
  createHost?: () => BabylonRenderHost;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<BabylonRenderHost | null>(null);
  const projectId = useSceneStore((s) => s.project?.metadata.id ?? null);
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

    const host = createHost ? createHost() : new BabylonRenderHost();
    host.mount(canvas);
    const adapter = host.adapter;
    hostRef.current = host;

    host.onTransformCommit((id, prev, next) =>
      executeCommand(
        new SetNodeTransformCommand({
          node_id: id,
          transform: next,
          prev_transform: prev,
        }),
      ),
    );
    host.setSnapProvider(() => {
      const nodes = useSceneStore.getState().project?.scene.nodes ?? {};
      return Object.values(nodes).map((n) => ({
        id: n.id,
        sockets: n.sockets ?? [],
        visible: n.visible,
        type: n.type,
      })) satisfies SnapNode[];
    });
    const syncGizmoTarget = (id: string | null) => {
      const node = id ? useSceneStore.getState().project?.scene.nodes[id] : undefined;
      host.setGizmoTarget(id, node ? isEffectivelyLocked(node) : false);
    };
    host.setGizmoMode(useUIStore.getState().gizmoMode);
    syncGizmoTarget(useUIStore.getState().selectedNodeId);

    const trySync = (node: SceneNode, op: SyncOp) => {
      try {
        adapter.syncNode(node, op);
      } catch (e) {
        console.warn(
          `BabylonViewport: syncNode ${op} failed for ${node.id} — skipped`,
          e,
        );
      }
    };
    const syncSelection = () => host.setSelection(useUIStore.getState().selectedNodeId);
    const applyDiff = (diff: SceneDiff) => {
      for (const n of diff.added) trySync(n, "add");
      for (const n of diff.updated) trySync(n, "update");
      for (const n of diff.removed) trySync(n, "remove");
      // Replay the highlight onto rebuilt instances: when a diff removes and
      // re-adds the selected node id, the old mesh's highlight dies with its
      // dispose (HighlightLayer auto-cleans), but the NEW mesh instance needs
      // a fresh addMesh — setSelection is idempotent, so replaying is safe.
      syncSelection();
      // Replay gizmo target onto the new node instance — after a diff the old
      // runtime object may have been disposed; re-pinning ensures the gizmo
      // points at the freshly-built mesh rather than a stale reference.
      syncGizmoTarget(useUIStore.getState().selectedNodeId);
    };

    const initial = useSceneStore.getState().project;
    if (initial) applyDiff(diffSceneNodes(EMPTY_SCENE_GRAPH, initial.scene));

    host.start();

    // Click-vs-drag guard (PR #8 convention): releasing an orbit drag inside
    // the canvas fires a click; only near-stationary releases count as picks.
    const DRAG_PX_TOLERANCE_SQ = 25; // 5px
    let downX = 0;
    let downY = 0;
    const onPointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const onClick = (event: MouseEvent) => {
      // Play mode: behaviors are running; clicking must not change the
      // selection / gizmo target (Properties + Behaviors panels stay locked to
      // whatever was selected when Play was pressed). Mirrors ThreeViewport.
      if (useUIStore.getState().playState === "play") return;
      const dx = event.clientX - downX;
      const dy = event.clientY - downY;
      if (dx * dx + dy * dy > DRAG_PX_TOLERANCE_SQ) return;
      const rect = canvas.getBoundingClientRect();
      useUIStore
        .getState()
        .setSelectedNodeId(
          adapter.pickAt(event.clientX - rect.left, event.clientY - rect.top),
        );
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);

    // Asset drag-drop: a library-card drag activates assetDragItemId. On
    // release inside the canvas, raycast the y=0 ground plane and add the item
    // there. Released outside the canvas we still clear the drag.
    // Bound on window so a release a few px past the canvas edge is still caught.
    const onAssetDrop = (event: PointerEvent) => {
      const dragId = useUIStore.getState().assetDragItemId;
      if (!dragId) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      if (inside) {
        const uploads = useSceneStore.getState().project?.assets ?? [];
        const item = findLibraryItem(dragId, uploads);
        if (item) {
          const node = item.makeNode();
          const hit = adapter.raycastGroundPoint(x, y);
          if (hit)
            node.transform.position = dropPositionFor(node.transform.position, hit);
          executeCommand(new AddNodeCommand({ node }));
          useUIStore.getState().setSelectedNodeId(node.id);
        }
      }
      useUIStore.getState().endAssetDrag();
    };
    window.addEventListener("pointerup", onAssetDrop);

    // Play / Pause side effects — snapshots capture every node's transform at
    // the moment Play is pressed; Pause restores them so the scene returns to
    // authored values rather than freezing at the behavior's last tick.
    const transformSnapshots = new Map<string, Transform>();
    let playing = false;

    const enterPlay = () => {
      const project = useSceneStore.getState().project;
      if (!project) return;
      transformSnapshots.clear();
      for (const node of Object.values(project.scene.nodes)) {
        const obj = adapter.getRuntimeObject(node.id) as BabylonNode | undefined;
        if (obj) transformSnapshots.set(node.id, captureTransform(obj));
        if (node.behaviors.length > 0)
          adapter.installBehaviors(node.id, node.behaviors);
      }
      host.setGizmoTarget(null, false);
      host.setSelection(null);
      playing = true;
    };

    const exitPlay = () => {
      playing = false;
      const project = useSceneStore.getState().project;
      if (project) {
        for (const node of Object.values(project.scene.nodes))
          adapter.uninstallBehaviors(node.id);
      }
      for (const [nodeId, t] of transformSnapshots) {
        const obj = adapter.getRuntimeObject(nodeId) as
          | (BabylonNode & {
              position?: Vector3;
              rotationQuaternion?: Quaternion | null;
              scaling?: Vector3;
            })
          | undefined;
        if (!obj) continue;
        obj.position?.set(t.position[0], t.position[1], t.position[2]);
        if (obj.rotationQuaternion) {
          obj.rotationQuaternion.set(
            t.rotation[0],
            t.rotation[1],
            t.rotation[2],
            t.rotation[3],
          );
        }
        obj.scaling?.set(t.scale[0], t.scale[1], t.scale[2]);
      }
      transformSnapshots.clear();
      host.setSelection(useUIStore.getState().selectedNodeId);
      syncGizmoTarget(useUIStore.getState().selectedNodeId);
    };

    host.setFrameCallback((dt) => {
      if (playing) adapter.tickBehaviors(dt);
    });

    const unsubscribeUI = useUIStore.subscribe((state, prev) => {
      if (state.selectedNodeId !== prev.selectedNodeId) {
        host.setSelection(state.selectedNodeId);
        syncGizmoTarget(state.selectedNodeId);
      }
      if (state.gizmoMode !== prev.gizmoMode) {
        host.setGizmoMode(state.gizmoMode);
      }
      if (state.playState !== prev.playState) {
        if (state.playState === "play") enterPlay();
        else exitPlay();
      }
    });

    const unsubscribe = useSceneStore.subscribe((state, prev) => {
      const next = state.project;
      const old = prev.project;
      if (!next || !old) return;
      if (next === old) return;
      if (next.metadata.id !== old.metadata.id) return; // handled by effect re-run
      applyDiff(diffSceneNodes(old.scene, next.scene));
    });

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      host.resize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      unsubscribe();
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
  }, [projectId, createHost]);

  // Focus watch effect — listens for useUIStore.requestFocus calls and moves
  // the camera so the requested node (or origin when id is null) sits centered
  // at a fitting distance. Lives outside the mount effect so it stays
  // subscribed across re-renders without rebuilding the renderer chain.
  // Consumes the request so the same request never fires twice.
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
        : ((host.adapter.getRuntimeObject(pendingFocusNodeId) as
            | BabylonNode
            | undefined) ?? null);
    const { target, distance } = computeBabylonFocusTarget(obj);
    host.focusCamera(target, distance);
    consumeFocusRequest();
  }, [pendingFocusNodeId, consumeFocusRequest]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}
