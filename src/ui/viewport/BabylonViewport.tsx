import { useEffect, useRef } from "react";

import type { SceneNode } from "@/core/scene/types";
import type { SyncOp } from "@/runtime/adapter";
import { BabylonRenderHost } from "@/runtime/babylon/render-host";
import { useSceneStore } from "@/services/scene/store";

import { diffSceneNodes, EMPTY_SCENE_GRAPH, type SceneDiff } from "./scene-diff";

/**
 * Babylon.js viewport (v1.0 B1 — view + orbit camera only). Mirrors
 * ThreeViewport's lifecycle conventions:
 *   - Mount effect re-runs only when the active project id changes; node
 *     edits flow through a useSceneStore subscription → diffSceneNodes →
 *     adapter.syncNode, so the canvas / camera state survive edits.
 *   - No picking / gizmo / play / drop / focus — those are B2–B4; the
 *     surrounding UI disables itself via isEngineEditingCapable.
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
    const applyDiff = (diff: SceneDiff) => {
      for (const n of diff.added) trySync(n, "add");
      for (const n of diff.updated) trySync(n, "update");
      for (const n of diff.removed) trySync(n, "remove");
    };

    const initial = useSceneStore.getState().project;
    if (initial) applyDiff(diffSceneNodes(EMPTY_SCENE_GRAPH, initial.scene));

    host.start();

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
      ro.disconnect();
      host.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [projectId, createHost]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}
