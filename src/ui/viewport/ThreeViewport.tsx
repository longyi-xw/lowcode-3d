import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { ThreeAdapter } from "@/runtime/three/adapter";
import type { SceneNode, SceneProject } from "@/core/scene/types";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

/**
 * Three.js viewport — mounts a WebGL canvas into a host div and mirrors the
 * SceneProject from `useSceneStore` into a private ThreeAdapter instance.
 *
 * Lifecycle:
 *   - Mount effect re-runs only when the active project id changes (or goes
 *     null↔non-null). Editing a transform of an existing node does NOT
 *     re-create the adapter, so OrbitControls keeps the user's camera state.
 *   - Inside the mount effect we subscribe to useSceneStore for fine-grained
 *     scene changes and translate them into `syncNode("update"/"add"/"remove")`
 *     on the live adapter.
 *   - On unmount / project switch: stop the loop, dispose every Three.js
 *     handle, unsubscribe from the store, remove the canvas + click listener.
 *
 * Component-level WebGL tests are deferred to E2E because jsdom has no WebGL;
 * ThreeAdapter (the layer doing the actual work) is unit-covered separately.
 */
export function ThreeViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const projectId = useSceneStore((s) => s.project?.metadata.id ?? null);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);

  useEffect(() => {
    if (!projectId) return;
    const container = containerRef.current;
    if (!container) return;

    const adapter = new ThreeAdapter();

    // Seed from current project state (may have changed between projectId
    // updating and this effect running, but only by mutation we missed —
    // re-reading getState() is the safe path).
    const initial = useSceneStore.getState().project;
    if (initial) seedScene(adapter, initial);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x101418, 1);
    renderer.shadowMap.enabled = true;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const controls = new OrbitControls(adapter.camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      adapter.setViewportSize(w, h);
      if (adapter.camera instanceof THREE.PerspectiveCamera) {
        adapter.camera.aspect = w / h;
        adapter.camera.updateProjectionMatrix();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setSelectedNodeId(adapter.pickAt(x, y));
    };
    canvas.addEventListener("click", onClick);

    // Subscribe for incremental updates. We diff node-by-node by identity:
    // the scene store always replaces changed nodes with a new SceneNode
    // object, so referential inequality means the data shifted.
    const unsubscribe = useSceneStore.subscribe((state, prev) => {
      const next = state.project;
      const old = prev.project;
      if (!next || !old) return;
      if (next === old) return;
      if (next.metadata.id !== old.metadata.id) return; // handled by effect re-run
      diffAndApply(adapter, old, next);
    });

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(adapter.scene, adapter.camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      unsubscribe();
      canvas.removeEventListener("click", onClick);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      adapter.dispose();
    };
  }, [projectId, setSelectedNodeId]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}

/**
 * BFS-walk the project so parents are added before their children — required
 * because ThreeAdapter.syncNode("add") refuses to attach a child whose parent
 * is not yet registered.
 */
function seedScene(adapter: ThreeAdapter, project: SceneProject): void {
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
 * syncNode calls. Update first (the common case during editing), then adds
 * (BFS-ordered so parents land first), then removes.
 *
 * Adds and removes are defensive: the scene store today only emits updates,
 * but this keeps the viewport correct if/when adders land.
 */
function diffAndApply(
  adapter: ThreeAdapter,
  old: SceneProject,
  next: SceneProject,
): void {
  // Updates + adds. To respect parents-before-children for adds, walk the
  // next project's tree BFS from roots and only act on truly-new ids.
  const queue: string[] = [...next.scene.root_node_ids];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const n = next.scene.nodes[id];
    if (!n) continue;
    const o = old.scene.nodes[id];
    if (!o) {
      adapter.syncNode(n, "add");
    } else if (n !== o) {
      adapter.syncNode(n, "update");
    }
    queue.push(...n.children_ids);
  }
  // Removes — anything in old but not in next.
  for (const id of Object.keys(old.scene.nodes)) {
    if (!next.scene.nodes[id]) {
      const removed = old.scene.nodes[id];
      if (removed) adapter.syncNode(removed, "remove");
    }
  }
}
