import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { snapTranslation } from "@/core/snap/grid";
import { SNAP_PIXELS, snapToNodes, type SnapPoint } from "@/core/snap/nodes";
import { isEffectivelyLocked } from "@/core/scene/policy";
import { ThreeAdapter } from "@/runtime/three/adapter";
import { describeTemplate } from "@/runtime/three/asset-cache";
import type {
  AssetReference,
  SceneNode,
  SceneProject,
  Transform,
} from "@/core/scene/types";
import { useAssetPreviewStore } from "@/services/assets/preview-store";
import { executeCommand } from "@/services/command-history";
import { useProjectStore } from "@/services/project/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { computeFocusTarget } from "./focus-helpers";

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
  // Mount-effect-owned handles surfaced as refs so cross-effect consumers
  // (currently the focus watch effect) can reach the live OrbitControls +
  // ThreeAdapter without forcing them to live as React state. Mutated only
  // inside the mount effect (set on construct, cleared on cleanup).
  const adapterRef = useRef<ThreeAdapter | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const projectId = useSceneStore((s) => s.project?.metadata.id ?? null);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const pendingFocusNodeId = useUIStore((s) => s.pendingFocusNodeId);
  const consumeFocusRequest = useUIStore((s) => s.consumeFocusRequest);

  useEffect(() => {
    if (!projectId) return;
    const container = containerRef.current;
    if (!container) return;

    const adapter = new ThreeAdapter();
    adapterRef.current = adapter;
    adapter.assetCache.setProjectPath(useProjectStore.getState().currentPath);

    const initial = useSceneStore.getState().project;
    if (initial) void seedScene(adapter, initial);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x101418, 1);
    renderer.shadowMap.enabled = true;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);
    adapter.setBehaviorDomElement(canvas);

    // Post-processing chain so we can stack an OutlinePass for selection
    // highlighting on top of the regular render. Render order: RenderPass
    // (scene) → OutlinePass (edge detection on selectedObjects) → OutputPass
    // (sRGB convert + tone-map so colours match the direct-render path).
    // Edge tuning: 2 / 0 / 1 = a thin, no-glow line so it reads as "marked"
    // without competing with the gizmo for attention. Colour matches the
    // app's primary accent (--primary, hsl 217 91% 60%) so the outline ties
    // into the same visual language as the selected hierarchy row.
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(adapter.scene, adapter.camera));
    const outlinePass = new OutlinePass(
      new THREE.Vector2(1, 1),
      adapter.scene,
      adapter.camera,
    );
    outlinePass.edgeStrength = 2;
    outlinePass.edgeGlow = 0;
    outlinePass.edgeThickness = 1;
    outlinePass.visibleEdgeColor.set("#3b82f6");
    outlinePass.hiddenEdgeColor.set("#1e3a5f");
    composer.addPass(outlinePass);
    composer.addPass(new OutputPass());

    const orbit = new OrbitControls(adapter.camera, canvas);
    controlsRef.current = orbit;
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;

    const gizmo = new TransformControls(adapter.camera, canvas);
    // TransformControls.getHelper() returns the visual representation —
    // the Helper is what gets added to the scene, NOT the controls instance
    // itself (which is a controller; adding it would attach unwanted state).
    adapter.scene.add(gizmo.getHelper());
    gizmo.setMode(useUIStore.getState().gizmoMode);

    let dragStart: Transform | null = null;
    let cachedTargets: SnapPoint[] = [];

    gizmo.addEventListener("dragging-changed", (event) => {
      const dragging = event.value as unknown as boolean;
      // Disable OrbitControls during a gizmo drag so the camera doesn't move
      // with the cursor.
      orbit.enabled = !dragging;
      // Hide the selection outline while dragging — the gizmo handles already
      // mark what's being manipulated, and an extra edge underneath competes
      // with the gizmo for attention. Restore on release from the current
      // selection state so we don't fight a concurrent selection change.
      if (dragging) {
        outlinePass.selectedObjects = [];
      } else {
        syncSelection(useUIStore.getState().selectedNodeId);
      }
    });
    gizmo.addEventListener("mouseDown", () => {
      const obj = gizmo.object;
      if (!obj) return;
      dragStart = captureTransform(obj);
      // Cache snap targets (other nodes' bbox features, projected to screen).
      // The camera is frozen during the drag (orbit disabled), so the screen
      // coords stay valid for the whole gesture.
      const draggedId = obj.userData.nodeId as string | undefined;
      const nodes = useSceneStore.getState().project?.scene.nodes ?? {};
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      cachedTargets = [];
      for (const id of Object.keys(nodes)) {
        const n = nodes[id];
        if (id === draggedId || !n || !n.visible || n.type === "helper") continue;
        const tobj = adapter.getRuntimeObject(id);
        if (!tobj) continue;
        cachedTargets.push(...featureSnapPoints(tobj, adapter.camera, w, h));
      }
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

    // Grid snap: hold Ctrl/Cmd while dragging to snap the translate gizmo to
    // the grid. Read the live modifier from pointer events (capture phase, so
    // it updates before TransformControls moves the object + fires
    // objectChange). Tracking via keydown/keyup is fragile — a missed keyup
    // (Cmd+Tab / Cmd+Z) leaves the flag stuck "down" and everything snaps;
    // pointer events carry the true current modifier every move.
    let snapModifierDown = false;
    const onSnapPointer = (e: PointerEvent) => {
      snapModifierDown = e.ctrlKey || e.metaKey;
    };
    window.addEventListener("pointermove", onSnapPointer, true);
    window.addEventListener("pointerdown", onSnapPointer, true);

    gizmo.addEventListener("objectChange", () => {
      const obj = gizmo.object;
      if (
        !obj ||
        useUIStore.getState().gizmoMode !== "translate" ||
        !snapModifierDown
      ) {
        return;
      }
      // Node-align snap first (bbox features → nearest other-node feature).
      const draggedPts = featureSnapPoints(
        obj,
        adapter.camera,
        canvas.clientWidth,
        canvas.clientHeight,
      );
      const offset = snapToNodes(draggedPts, cachedTargets, SNAP_PIXELS);
      if (offset) {
        obj.position.set(
          obj.position.x + offset[0],
          obj.position.y + offset[1],
          obj.position.z + offset[2],
        );
        return;
      }
      // Grid fallback (sub-stage A).
      const [x, y, z] = snapTranslation([
        obj.position.x,
        obj.position.y,
        obj.position.z,
      ]);
      obj.position.set(x, y, z);
    });

    const syncSelection = (id: string | null) => {
      if (!id) {
        gizmo.detach();
        outlinePass.selectedObjects = [];
        return;
      }
      const obj = adapter.getRuntimeObject(id);
      if (!obj) {
        gizmo.detach();
        outlinePass.selectedObjects = [];
        return;
      }
      // Locked nodes still get the outline so the user can see what they
      // selected, but the gizmo doesn't attach — preventing accidental
      // drag-edits of editor chrome (grid, future axes/guides). The
      // properties panel separately disables its inputs for the same reason.
      // Lock semantics go through `isEffectivelyLocked`, not `node.locked`,
      // so helpers stay locked even when an older project file on disk has
      // `locked: false` written for them.
      const node = useSceneStore.getState().project?.scene.nodes[id];
      if (node && isEffectivelyLocked(node)) {
        gizmo.detach();
      } else {
        gizmo.attach(obj);
      }
      outlinePass.selectedObjects = [obj];
    };
    syncSelection(useUIStore.getState().selectedNodeId);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      outlinePass.setSize(w, h);
      adapter.setViewportSize(w, h);
      if (adapter.camera instanceof THREE.PerspectiveCamera) {
        adapter.camera.aspect = w / h;
        adapter.camera.updateProjectionMatrix();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

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

    // ── Play / Pause side effects ─────────────────────────────────
    // transformSnapshots captures every Object3D's transform at the moment
    // Play is pressed so Pause can restore them — otherwise the cube would
    // stay frozen at whatever rotation the behavior happened to be at when
    // the user paused, instead of returning to the authored value.
    const transformSnapshots = new Map<string, Transform>();
    let playClock: THREE.Clock | null = null;

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
      gizmo.detach();
      outlinePass.selectedObjects = [];
      playClock = new THREE.Clock();
    };

    const exitPlay = () => {
      playClock = null;
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
      syncSelection(useUIStore.getState().selectedNodeId);
    };

    const unsubscribeScene = useSceneStore.subscribe((state, prev) => {
      const next = state.project;
      const old = prev.project;
      if (!next || !old) return;
      if (next === old) return;
      if (next.metadata.id !== old.metadata.id) return; // handled by effect re-run
      void diffAndApply(adapter, old, next, gizmo, outlinePass);
    });

    const unsubscribeProject = useProjectStore.subscribe((state, prev) => {
      if (state.currentPath !== prev.currentPath) {
        adapter.assetCache.setProjectPath(state.currentPath);
      }
    });

    const unsubscribeUI = useUIStore.subscribe((state, prev) => {
      if (state.selectedNodeId !== prev.selectedNodeId) {
        syncSelection(state.selectedNodeId);
      }
      if (state.gizmoMode !== prev.gizmoMode) {
        gizmo.setMode(state.gizmoMode);
      }
      if (state.playState !== prev.playState) {
        if (state.playState === "play") enterPlay();
        else exitPlay();
      }
    });

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      orbit.update();
      if (playClock) {
        adapter.tickBehaviors(playClock.getDelta());
      }
      composer.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      unsubscribeScene();
      unsubscribeProject();
      unsubscribeUI();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onSnapPointer, true);
      window.removeEventListener("pointerdown", onSnapPointer, true);
      ro.disconnect();
      gizmo.detach();
      gizmo.dispose();
      orbit.dispose();
      composer.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      adapter.dispose();
      adapterRef.current = null;
      controlsRef.current = null;
    };
  }, [projectId, setSelectedNodeId]);

  // Focus watch effect — listens for useUIStore.requestFocus calls and
  // moves OrbitControls.target + camera position so the requested node
  // (or the scene origin when id is null) sits centered at a fitting
  // distance. Lives outside the mount effect so it stays subscribed
  // across re-renders without rebuilding the renderer chain. Consumes
  // the request (sets it back to undefined) so the same request never
  // fires twice.
  useEffect(() => {
    if (pendingFocusNodeId === undefined) return;
    const adapter = adapterRef.current;
    const controls = controlsRef.current;
    if (!adapter || !controls) {
      consumeFocusRequest();
      return;
    }
    const obj =
      pendingFocusNodeId === null
        ? null
        : (adapter.getRuntimeObject(pendingFocusNodeId) ?? null);
    const { target, distance } = computeFocusTarget(obj);
    controls.target.copy(target);
    // Move camera along the current view direction so the target sits at the
    // new distance without changing the view angle.
    const dir = new THREE.Vector3();
    adapter.camera.getWorldDirection(dir).negate(); // direction from target to camera
    adapter.camera.position.copy(target).add(dir.multiplyScalar(distance));
    controls.update();
    consumeFocusRequest();
  }, [pendingFocusNodeId, consumeFocusRequest]);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}

/** 15 个 bbox 特征（中心 + 8 角 + 6 面中心）的世界坐标；无几何（bbox 空）返回
 *  []。面中心让"球放到 box 顶面/侧面"这类面对面对齐也能吸附。 */
function bboxFeatures(obj: THREE.Object3D): THREE.Vector3[] {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return [];
  const c = new THREE.Vector3();
  box.getCenter(c);
  const { min, max } = box;
  return [
    c,
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z),
    // 6 face centers — so "ball on a box's top/side" (face-to-face) snaps too.
    new THREE.Vector3(max.x, c.y, c.z),
    new THREE.Vector3(min.x, c.y, c.z),
    new THREE.Vector3(c.x, max.y, c.z),
    new THREE.Vector3(c.x, min.y, c.z),
    new THREE.Vector3(c.x, c.y, max.z),
    new THREE.Vector3(c.x, c.y, min.z),
  ];
}

/** 世界坐标 → 屏幕像素（用 canvas 尺寸）。 */
function toScreen(
  v: THREE.Vector3,
  camera: THREE.Camera,
  w: number,
  h: number,
): [number, number] {
  const ndc = v.clone().project(camera);
  return [((ndc.x + 1) / 2) * w, ((1 - ndc.y) / 2) * h];
}

/** 一个 Object3D 的 bbox 特征 → SnapPoint[]（屏幕 + 世界）。 */
function featureSnapPoints(
  obj: THREE.Object3D,
  camera: THREE.Camera,
  w: number,
  h: number,
): SnapPoint[] {
  return bboxFeatures(obj).map((v) => ({
    screen: toScreen(v, camera, w, h),
    world: [v.x, v.y, v.z] as [number, number, number],
  }));
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
 * syncNode calls. Update first (the common case during editing), then adds
 * (BFS-ordered so parents land first), then removes — detaching the gizmo
 * before any node it's currently attached to disappears.
 *
 * Async because newly-added prefab_instance nodes may reference an asset
 * not yet in the cache; we kick off syncAsset for any unknown asset_ids
 * surfaced in the diff so the rebuild path picks them up.
 */
async function diffAndApply(
  adapter: ThreeAdapter,
  old: SceneProject,
  next: SceneProject,
  gizmo: TransformControls,
  outlinePass: OutlinePass,
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
        if (outlinePass.selectedObjects.some((obj) => obj.userData.nodeId === id)) {
          outlinePass.selectedObjects = [];
        }
        adapter.syncNode(removed, "remove");
      }
    }
  }
}
