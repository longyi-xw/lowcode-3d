import { useEffect, useRef } from "react";

import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { isEffectivelyLocked } from "@/core/scene/policy";
import type { SceneNode } from "@/core/scene/types";
import type { SyncOp } from "@/runtime/adapter";
import { BabylonRenderHost } from "@/runtime/babylon/render-host";
import type { SnapNode } from "@/runtime/render-host";
import { executeCommand } from "@/services/command-history";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

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
  const projectId = useSceneStore((s) => s.project?.metadata.id ?? null);

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

    const unsubscribeUI = useUIStore.subscribe((state, prev) => {
      if (state.selectedNodeId !== prev.selectedNodeId) {
        host.setSelection(state.selectedNodeId);
        syncGizmoTarget(state.selectedNodeId);
      }
      if (state.gizmoMode !== prev.gizmoMode) {
        host.setGizmoMode(state.gizmoMode);
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
      ro.disconnect();
      host.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [projectId, createHost]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}
