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
 *   - On mount: allocate adapter + WebGLRenderer + OrbitControls, attach to
 *     the host div, start the rAF loop. Canvas "click" raycasts the scene
 *     and writes the picked node id (or null) into useUIStore.
 *   - On unmount: stop the loop, dispose every Three.js handle (renderer,
 *     controls, adapter, the canvas element), disconnect ResizeObserver,
 *     remove the click listener.
 *   - On `project` change: dispose the previous adapter and rebuild from the
 *     new project. Phase 2 will replace this with surgical per-node updates
 *     driven by the Command system; for now whole-tree replace is fine
 *     because projects are small and we don't yet preserve viewport state
 *     across edits.
 *
 * Component-level tests are deferred to E2E because WebGL doesn't exist in
 * jsdom. The ThreeAdapter underneath this component (including its pickAt
 * raycast logic) is unit-covered in `src/runtime/three/adapter.test.ts`.
 */
export function ThreeViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useSceneStore((s) => s.project);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const adapter = new ThreeAdapter();
    if (project) seedScene(adapter, project);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x101418, 1);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(adapter.camera, renderer.domElement);
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

    // Browser "click" only fires after a non-drag pointer-up, so OrbitControls
    // drags don't accidentally clear the selection. Modifier keys are ignored
    // for now — multi-select / range-select is a Phase 1 B concern.
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setSelectedNodeId(adapter.pickAt(x, y));
    };
    renderer.domElement.addEventListener("click", onClick);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(adapter.scene, adapter.camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener("click", onClick);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      adapter.dispose();
    };
  }, [project, setSelectedNodeId]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/**
 * BFS-walk the project so parents are added before their children. Required
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
