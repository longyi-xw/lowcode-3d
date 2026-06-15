import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

import type { GizmoMode } from "@/core/editor-types";
import type { Transform } from "@/core/scene/types";
import type { IRenderHost, SnapNode } from "@/runtime/render-host";
import { ThreeAdapter } from "@/runtime/three/adapter";

import { computeSnapOffset, featureSnapPoints, socketPoints } from "./snap-features";
import { captureTransform, transformsEqual } from "./transform-util";

/**
 * Three.js render host (v1.0 B3a) — owns the WebGLRenderer, post-processing
 * chain (OutlinePass selection highlight), OrbitControls, TransformControls
 * (gizmo) and the render loop. Extracted from ThreeViewport's mount effect as
 * a behavior-preserving refactor: the GL/gizmo/snap logic below is the same
 * as ThreeViewport's, with three seams replacing direct Zustand store reads —
 * `gizmoMode` (via setGizmoMode), `snapProvider` (via setSnapProvider) and
 * `commitCb` (via onTransformCommit) — so this class stays store-agnostic.
 *
 * The ThreeAdapter it creates owns the scene; dispose() here also disposes
 * the adapter (mirrors BabylonRenderHost's ownership rule).
 *
 * Component-level WebGL tests are deferred to E2E because jsdom has no
 * WebGL — this class is exercised via visual smoke, not unit tests.
 */
export class ThreeRenderHost implements IRenderHost {
  readonly engine = "three.js" as const;

  private adapterInstance: ThreeAdapter | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private outlinePass: OutlinePass | null = null;
  private orbit: OrbitControls | null = null;
  private gizmo: TransformControls | null = null;
  private clock: THREE.Clock | null = null;
  private rafId = 0;

  private commitCb: ((id: string, prev: Transform, next: Transform) => void) | null =
    null;
  private snapProvider: (() => SnapNode[]) | null = null;
  private frameCb: ((dt: number) => void) | null = null;

  private gizmoMode: GizmoMode = "translate";
  private currentSelectionId: string | null = null;
  private dragStart: Transform | null = null;
  private cachedTargets: ReturnType<typeof featureSnapPoints> = [];
  private cachedSocketTargets: ReturnType<typeof socketPoints> = [];
  private snapModifierDown = false;
  private readonly onSnapPointer = (e: PointerEvent) => {
    this.snapModifierDown = e.ctrlKey || e.metaKey;
  };

  /** Engine-specific surface (not on IRenderHost) — the viewport reaches
   *  through it for B4 features that stay in the component (socket markers,
   *  asset drop). Throws before mount() / after dispose(). */
  get adapter(): ThreeAdapter {
    if (!this.adapterInstance) {
      throw new Error("ThreeRenderHost: call mount() before adapter");
    }
    return this.adapterInstance;
  }

  mount(canvas: HTMLCanvasElement): void {
    const adapter = new ThreeAdapter();
    this.adapterInstance = adapter;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x101418, 1);
    renderer.shadowMap.enabled = true;
    this.renderer = renderer;
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
    this.composer = composer;
    this.outlinePass = outlinePass;

    const orbit = new OrbitControls(adapter.camera, canvas);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    this.orbit = orbit;

    const gizmo = new TransformControls(adapter.camera, canvas);
    // TransformControls.getHelper() returns the visual representation —
    // the Helper is what gets added to the scene, NOT the controls instance
    // itself (which is a controller; adding it would attach unwanted state).
    adapter.scene.add(gizmo.getHelper());
    gizmo.setMode(this.gizmoMode);
    this.gizmo = gizmo;

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
        this.setSelection(this.currentSelectionId);
      }
    });
    gizmo.addEventListener("mouseDown", () => {
      const obj = gizmo.object;
      if (!obj) return;
      this.dragStart = captureTransform(obj);
      // Cache snap targets (other nodes' bbox features, projected to screen).
      // The camera is frozen during the drag (orbit disabled), so the screen
      // coords stay valid for the whole gesture.
      const draggedId = obj.userData.nodeId as string | undefined;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      this.cachedTargets = [];
      this.cachedSocketTargets = [];
      for (const n of this.snapProvider?.() ?? []) {
        if (n.id === draggedId || !n.visible || n.type === "helper") continue;
        const tobj = adapter.getRuntimeObject(n.id);
        if (!tobj) continue;
        this.cachedTargets.push(...featureSnapPoints(tobj, adapter.camera, w, h));
        this.cachedSocketTargets.push(
          ...socketPoints(tobj, n.sockets, adapter.camera, w, h),
        );
      }
    });
    gizmo.addEventListener("mouseUp", () => {
      const obj = gizmo.object;
      const start = this.dragStart;
      this.dragStart = null;
      if (!obj || !start) return;
      const nodeId = obj.userData.nodeId;
      if (typeof nodeId !== "string") return;
      const end = captureTransform(obj);
      if (transformsEqual(start, end)) return;
      this.commitCb?.(nodeId, start, end);
    });

    // Grid snap: hold Ctrl/Cmd while dragging to snap the translate gizmo to
    // the grid. Read the live modifier from pointer events (capture phase, so
    // it updates before TransformControls moves the object + fires
    // objectChange). Tracking via keydown/keyup is fragile — a missed keyup
    // (Cmd+Tab / Cmd+Z) leaves the flag stuck "down" and everything snaps;
    // pointer events carry the true current modifier every move.
    window.addEventListener("pointermove", this.onSnapPointer, true);
    window.addEventListener("pointerdown", this.onSnapPointer, true);

    gizmo.addEventListener("objectChange", () => {
      this.snapDraggedObject();
    });

    this.clock = new THREE.Clock();
  }

  start(): void {
    if (this.rafId) return;
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      this.orbit?.update();
      const dt = this.clock?.getDelta() ?? 0;
      this.frameCb?.(dt);
      this.composer?.render();
    };
    tick();
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.renderer?.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.outlinePass?.setSize(width, height);
    this.adapterInstance?.setViewportSize(width, height);
    const cam = this.adapterInstance?.camera;
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
    }
  }

  setSelection(node_id: string | null): void {
    this.currentSelectionId = node_id;
    if (!this.outlinePass) return;
    const obj = node_id ? this.adapterInstance?.getRuntimeObject(node_id) : null;
    this.outlinePass.selectedObjects = obj ? [obj] : [];
  }

  setGizmoMode(mode: GizmoMode): void {
    this.gizmoMode = mode;
    this.gizmo?.setMode(mode);
  }

  setGizmoTarget(node_id: string | null, locked: boolean): void {
    const obj = node_id ? this.adapterInstance?.getRuntimeObject(node_id) : null;
    if (!obj || locked) this.gizmo?.detach();
    else this.gizmo?.attach(obj);
  }

  onTransformCommit(cb: (id: string, prev: Transform, next: Transform) => void): void {
    this.commitCb = cb;
  }

  setSnapProvider(provider: () => SnapNode[]): void {
    this.snapProvider = provider;
  }

  /** Engine-specific surface — per-frame hook so the viewport can tick play
   *  behaviors without the host knowing about play state. */
  setFrameCallback(cb: ((dt: number) => void) | null): void {
    this.frameCb = cb;
  }

  /** Engine-specific surface — focus effect moves camera + controls (both
   *  owned here now). target/distance computed by the viewport via
   *  computeFocusTarget. */
  focusCamera(target: THREE.Vector3, distance: number): void {
    const cam = this.adapterInstance?.camera;
    const orbit = this.orbit;
    if (!cam || !orbit) return;
    orbit.target.copy(target);
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir).negate();
    cam.position.copy(target).add(dir.multiplyScalar(distance));
    orbit.update();
  }

  private snapDraggedObject(): void {
    const obj = this.gizmo?.object;
    if (!obj || this.gizmoMode !== "translate" || !this.snapModifierDown) return;
    const cam = this.adapterInstance!.camera;
    const w = this.renderer!.domElement.clientWidth;
    const h = this.renderer!.domElement.clientHeight;
    const draggedNodeId = obj.userData.nodeId as string | undefined;
    const draggedNode = this.snapProvider?.().find((n) => n.id === draggedNodeId);
    const hasSockets = (draggedNode?.sockets ?? []).some((s) => s.tag);
    const offset = computeSnapOffset({
      currentPos: [obj.position.x, obj.position.y, obj.position.z],
      draggedFeatures: featureSnapPoints(obj, cam, w, h),
      draggedSockets: socketPoints(obj, draggedNode?.sockets ?? [], cam, w, h),
      hasSockets,
      targetFeatures: this.cachedTargets,
      targetSockets: this.cachedSocketTargets,
    });
    if (offset) {
      obj.position.set(
        obj.position.x + offset[0],
        obj.position.y + offset[1],
        obj.position.z + offset[2],
      );
    }
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("pointermove", this.onSnapPointer, true);
    window.removeEventListener("pointerdown", this.onSnapPointer, true);
    this.gizmo?.detach();
    this.gizmo?.dispose();
    this.orbit?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
    this.adapterInstance?.dispose();
    this.adapterInstance = null;
    this.renderer = null;
    this.composer = null;
    this.outlinePass = null;
    this.orbit = null;
    this.gizmo = null;
    this.clock = null;
    this.commitCb = null;
    this.snapProvider = null;
    this.frameCb = null;
  }
}
