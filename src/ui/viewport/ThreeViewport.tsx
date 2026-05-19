import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { ThreeAdapter } from "@/runtime/three/adapter";
import type { SceneNode, SceneProject, Transform } from "@/core/scene/types";
import { executeCommand } from "@/services/command-history";
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
 *     on the live adapter. We also subscribe to useUIStore for selection +
 *     gizmo-mode changes, attaching / detaching TransformControls accordingly.
 *   - TransformControls drags emit one SetNodeTransformCommand each on
 *     mouseUp — never on objectChange — so a continuous drag is one undo
 *     entry rather than many. Mid-drag the Object3D moves freely without
 *     a round-trip through the scene store.
 *   - On unmount / project switch: stop the loop, dispose every Three.js
 *     handle, unsubscribe from stores, remove the canvas + click listener.
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

    const orbit = new OrbitControls(adapter.camera, canvas);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;

    const gizmo = new TransformControls(adapter.camera, canvas);
    // TransformControls.getHelper() returns the visual representation —
    // the Helper is what gets added to the scene, NOT the controls instance
    // itself (which is a controller; adding it would attach unwanted state).
    adapter.scene.add(gizmo.getHelper());
    gizmo.setMode(useUIStore.getState().gizmoMode);

    let dragStart: Transform | null = null;

    gizmo.addEventListener("dragging-changed", (event) => {
      // Disable OrbitControls during a gizmo drag so the camera doesn't move
      // with the cursor.
      orbit.enabled = !(event.value as unknown as boolean);
    });
    gizmo.addEventListener("mouseDown", () => {
      const obj = gizmo.object;
      if (!obj) return;
      dragStart = captureTransform(obj);
    });
    gizmo.addEventListener("mouseUp", () => {
      const obj = gizmo.object;
      const start = dragStart;
      dragStart = null;
      if (!obj || !start) return;
      const nodeId = obj.userData.nodeId;
      if (typeof nodeId !== "string") return;
      const end = captureTransform(obj);
      if (transformsEqual(start, end)) return;
      executeCommand(
        new SetNodeTransformCommand({
          node_id: nodeId,
          transform: end,
          prev_transform: start,
        }),
      );
    });

    const attachGizmoToSelection = (id: string | null) => {
      if (!id) {
        gizmo.detach();
        return;
      }
      const obj = adapter.getRuntimeObject(id);
      if (obj) gizmo.attach(obj);
      else gizmo.detach();
    };
    attachGizmoToSelection(useUIStore.getState().selectedNodeId);

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

    const unsubscribeScene = useSceneStore.subscribe((state, prev) => {
      const next = state.project;
      const old = prev.project;
      if (!next || !old) return;
      if (next === old) return;
      if (next.metadata.id !== old.metadata.id) return; // handled by effect re-run
      diffAndApply(adapter, old, next, gizmo);
    });

    const unsubscribeUI = useUIStore.subscribe((state, prev) => {
      if (state.selectedNodeId !== prev.selectedNodeId) {
        attachGizmoToSelection(state.selectedNodeId);
      }
      if (state.gizmoMode !== prev.gizmoMode) {
        gizmo.setMode(state.gizmoMode);
      }
    });

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      orbit.update();
      renderer.render(adapter.scene, adapter.camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      unsubscribeScene();
      unsubscribeUI();
      canvas.removeEventListener("click", onClick);
      ro.disconnect();
      gizmo.detach();
      gizmo.dispose();
      orbit.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      adapter.dispose();
    };
  }, [projectId, setSelectedNodeId]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}

function captureTransform(obj: THREE.Object3D): Transform {
  return {
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
  };
}

function transformsEqual(a: Transform, b: Transform): boolean {
  return (
    a.position[0] === b.position[0] &&
    a.position[1] === b.position[1] &&
    a.position[2] === b.position[2] &&
    a.rotation[0] === b.rotation[0] &&
    a.rotation[1] === b.rotation[1] &&
    a.rotation[2] === b.rotation[2] &&
    a.rotation[3] === b.rotation[3] &&
    a.scale[0] === b.scale[0] &&
    a.scale[1] === b.scale[1] &&
    a.scale[2] === b.scale[2]
  );
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
 * (BFS-ordered so parents land first), then removes — detaching the gizmo
 * before any node it's currently attached to disappears.
 */
function diffAndApply(
  adapter: ThreeAdapter,
  old: SceneProject,
  next: SceneProject,
  gizmo: TransformControls,
): void {
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
  for (const id of Object.keys(old.scene.nodes)) {
    if (!next.scene.nodes[id]) {
      const removed = old.scene.nodes[id];
      if (removed) {
        if (gizmo.object && gizmo.object.userData.nodeId === id) {
          gizmo.detach();
        }
        adapter.syncNode(removed, "remove");
      }
    }
  }
}
