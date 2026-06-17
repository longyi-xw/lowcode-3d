import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GizmoManager,
  HighlightLayer,
  Mesh,
  Vector3,
  type AbstractEngine,
  type Node as BabylonNode,
} from "@babylonjs/core";

import type { IRenderHost, SnapNode } from "@/runtime/render-host";
import type { GizmoMode } from "@/core/editor-types";
import type { Transform } from "@/core/scene/types";

import { computeSnapOffset } from "@/core/snap/offset";
import { transformsEqual } from "@/runtime/transform-util";
import { BabylonAdapter } from "./adapter";
import { featureSnapPoints, socketPoints } from "./snap-features";
import { captureTransform } from "./transform-util";

export interface BabylonRenderHostOptions {
  /** Test seam — defaults to a real WebGL Engine on the mounted canvas.
   *  Tests inject () => new NullEngine() because jsdom has no WebGL. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine;
}

/** Matches ThreeViewport's renderer.setClearColor(0x101418). */
const CLEAR_COLOR = new Color4(0x10 / 255, 0x14 / 255, 0x18 / 255, 1);

/** Matches ThreeViewport's OutlinePass visibleEdgeColor (#3b82f6). */
const SELECTION_COLOR = Color3.FromHexString("#3b82f6");

/**
 * Babylon render host (v1.0 B1) — owns the real Engine, the editor
 * ArcRotateCamera and the render loop. The BabylonAdapter it creates owns the
 * scene AND the engine disposal (spec §4 ownership rule), so dispose() here
 * never calls engine.dispose() itself.
 */
export class BabylonRenderHost implements IRenderHost {
  readonly engine = "babylon.js" as const;
  private readonly createEngine: (canvas: HTMLCanvasElement) => AbstractEngine;
  private babylonEngine: AbstractEngine | null = null;
  private camera: ArcRotateCamera | null = null;
  private adapterInstance: BabylonAdapter | null = null;
  private highlight: HighlightLayer | null = null;

  // ── Gizmo state (B3b) ──
  private gizmoManager: GizmoManager | null = null;
  private gizmoMode: GizmoMode = "translate";
  /** Gizmo instances we've already attached drag observers to. GizmoManager
   *  reuses (does NOT dispose) a gizmo when its *Enabled flag toggles, so
   *  wiring must be idempotent or observers accumulate across mode switches. */
  private readonly wiredGizmos = new WeakSet<object>();
  private attachedNodeId: string | null = null;
  private commitCb: ((id: string, prev: Transform, next: Transform) => void) | null =
    null;
  private snapProvider: (() => SnapNode[]) | null = null;
  private dragStart: Transform | null = null;
  private cachedTargets: ReturnType<typeof featureSnapPoints> = [];
  private cachedSocketTargets: ReturnType<typeof socketPoints> = [];
  private snapModifierDown = false;
  private readonly onSnapPointer = (e: PointerEvent) => {
    this.snapModifierDown = e.ctrlKey || e.metaKey;
  };

  constructor(options?: BabylonRenderHostOptions) {
    this.createEngine = options?.createEngine ?? ((canvas) => new Engine(canvas, true));
  }

  /** Engine-specific surface (not on IRenderHost) — BabylonViewport reaches
   *  through it for syncNode. Throws before mount() / after dispose(). */
  get adapter(): BabylonAdapter {
    if (!this.adapterInstance) {
      throw new Error("BabylonRenderHost: call mount() before adapter");
    }
    return this.adapterInstance;
  }

  /** Test-only surface: lets unit tests inspect the GizmoManager. */
  get gizmoManagerForTest(): GizmoManager | null {
    return this.gizmoManager;
  }

  mount(canvas: HTMLCanvasElement): void {
    const engine = this.createEngine(canvas);
    this.babylonEngine = engine;
    const adapter = new BabylonAdapter({ engine });
    this.adapterInstance = adapter;
    const scene = adapter.scene;
    scene.clearColor = CLEAR_COLOR;
    // Editor orbit camera — framing matches the Three editor camera defaults
    // (position [4,3,4] looking at the origin, vertical fov 50°; see
    // ThreeAdapter defaultCamera). Alpha/beta/radius args are placeholders:
    // setPosition() recomputes them from the actual position.
    const camera = new ArcRotateCamera("editor-camera", 0, 1, 8, Vector3.Zero(), scene);
    camera.setPosition(new Vector3(4, 3, 4));
    camera.fov = (50 * Math.PI) / 180;
    camera.minZ = 0.1;
    camera.maxZ = 1000;
    // NullEngine has no rendering canvas — pointer controls only make sense
    // on a real Engine.
    if (engine.getRenderingCanvas()) camera.attachControl();
    // Selection highlight — engine-side counterpart of ThreeViewport's
    // OutlinePass. Works on NullEngine too (verified), so no headless guard.
    this.highlight = new HighlightLayer("selection-highlight", scene);
    scene.activeCamera = camera;
    this.camera = camera;

    // GizmoManager — usePointerToAttachGizmos=false because selection is
    // driven by the editor store (setGizmoTarget), not pointer picking.
    // All three gizmo flags start false; setGizmoMode enables the right one.
    // No manual camera detach needed during drag: Babylon gizmos use
    // PointerDragBehavior, which has detachCameraControls=true by default, so
    // the ArcRotateCamera stops orbiting for the drag's duration on its own
    // (unlike Three, where ThreeRenderHost must toggle orbit.enabled).
    const gm = new GizmoManager(scene);
    gm.usePointerToAttachGizmos = false;
    gm.positionGizmoEnabled = false;
    gm.rotationGizmoEnabled = false;
    gm.scaleGizmoEnabled = false;
    this.gizmoManager = gm;
    window.addEventListener("pointermove", this.onSnapPointer, true);
    window.addEventListener("pointerdown", this.onSnapPointer, true);
  }

  start(): void {
    const engine = this.babylonEngine;
    const scene = this.adapterInstance?.scene;
    if (!engine || !scene) return;
    engine.runRenderLoop(() => scene.render());
  }

  stop(): void {
    this.babylonEngine?.stopRenderLoop();
  }

  resize(_width: number, _height: number): void {
    // Babylon reads the canvas client size itself; params exist for the
    // engine-neutral contract.
    this.babylonEngine?.resize();
  }

  /** Test-only surface: lets unit tests assert hasMesh membership. */
  get selectionLayer(): HighlightLayer | null {
    return this.highlight;
  }

  setSelection(node_id: string | null): void {
    const layer = this.highlight;
    const adapter = this.adapterInstance;
    if (!layer || !adapter) return;
    layer.removeAllMeshes();
    if (!node_id) return;
    const root = adapter.getRuntimeObject(node_id) as BabylonNode | undefined;
    if (!root) return; // removed/unknown — an empty layer is the right state
    if (root instanceof Mesh) layer.addMesh(root, SELECTION_COLOR);
    for (const child of root.getDescendants(false)) {
      if (child instanceof Mesh) layer.addMesh(child, SELECTION_COLOR);
    }
  }

  // ── Gizmo + snap (B3b) ──

  setGizmoMode(mode: GizmoMode): void {
    this.gizmoMode = mode;
    const gm = this.gizmoManager;
    if (!gm) return;
    // Toggling *Enabled creates the gizmo on first true (and reuses it after);
    // false only detaches it. Wire its observers once it exists (idempotent —
    // see wireActiveGizmo).
    gm.positionGizmoEnabled = mode === "translate";
    gm.rotationGizmoEnabled = mode === "rotate";
    gm.scaleGizmoEnabled = mode === "scale";
    this.wireActiveGizmo();
  }

  setGizmoTarget(node_id: string | null, locked: boolean): void {
    this.attachedNodeId = node_id && !locked ? node_id : null;
    const gm = this.gizmoManager;
    const adapter = this.adapterInstance;
    if (!gm || !adapter) return;
    const obj = this.attachedNodeId
      ? (adapter.getRuntimeObject(this.attachedNodeId) as BabylonNode | undefined)
      : undefined;
    gm.attachToNode(obj ?? null);
  }

  onTransformCommit(cb: (id: string, prev: Transform, next: Transform) => void): void {
    this.commitCb = cb;
  }

  setSnapProvider(provider: () => SnapNode[]): void {
    this.snapProvider = provider;
  }

  /** Attach drag observers to the currently-enabled gizmo, once per gizmo
   *  instance. GizmoManager reuses (does not dispose) a gizmo across *Enabled
   *  toggles, so without the wiredGizmos guard every mode switch would stack
   *  another observer and fire onDragStart/End/Drag multiple times per drag. */
  private wireActiveGizmo(): void {
    const gm = this.gizmoManager;
    if (!gm) return;
    if (this.gizmoMode === "translate") {
      const pg = gm.gizmos.positionGizmo;
      if (!pg || this.wiredGizmos.has(pg)) return;
      this.wiredGizmos.add(pg);
      // Show the plane-drag handles too (the axis arrows alone only allow
      // single-axis drag); matches Three's TransformControls which has both
      // axis and plane handles. Plane drags fire the same onDrag* observables.
      pg.planarGizmoEnabled = true;
      pg.onDragStartObservable.add(() => this.onGizmoDragStart());
      pg.onDragEndObservable.add(() => this.onGizmoDragEnd());
      pg.onDragObservable.add(() => this.onGizmoDrag()); // snap, translate only
      return;
    }
    const g =
      this.gizmoMode === "rotate" ? gm.gizmos.rotationGizmo : gm.gizmos.scaleGizmo;
    if (!g || this.wiredGizmos.has(g)) return;
    this.wiredGizmos.add(g);
    g.onDragStartObservable.add(() => this.onGizmoDragStart());
    g.onDragEndObservable.add(() => this.onGizmoDragEnd());
  }

  private draggedNode(): BabylonNode | undefined {
    if (!this.attachedNodeId) return undefined;
    return this.adapterInstance?.getRuntimeObject(this.attachedNodeId) as
      | BabylonNode
      | undefined;
  }

  private viewportSize(): [number, number] {
    const eng = this.babylonEngine;
    return [eng?.getRenderWidth() ?? 0, eng?.getRenderHeight() ?? 0];
  }

  private onGizmoDragStart(): void {
    const node = this.draggedNode();
    if (!node) return;
    this.dragStart = captureTransform(node);
    this.highlight?.removeAllMeshes(); // hide selection outline during drag
    this.cachedTargets = [];
    this.cachedSocketTargets = [];
    if (this.gizmoMode !== "translate") return; // only translate snaps
    const scene = this.adapterInstance?.scene;
    const adapter = this.adapterInstance;
    if (!scene || !adapter) return;
    const [w, h] = this.viewportSize();
    for (const n of this.snapProvider?.() ?? []) {
      if (n.id === this.attachedNodeId || !n.visible || n.type === "helper") continue;
      const tobj = adapter.getRuntimeObject(n.id) as BabylonNode | undefined;
      if (!tobj) continue;
      this.cachedTargets.push(...featureSnapPoints(tobj, scene, w, h));
      this.cachedSocketTargets.push(...socketPoints(tobj, n.sockets, scene, w, h));
    }
  }

  private onGizmoDrag(): void {
    const node = this.draggedNode() as
      | (BabylonNode & { position: Vector3 })
      | undefined;
    if (!node || this.gizmoMode !== "translate" || !this.snapModifierDown) return;
    const scene = this.adapterInstance?.scene;
    if (!scene) return;
    const [w, h] = this.viewportSize();
    const draggedNode = this.snapProvider?.().find((n) => n.id === this.attachedNodeId);
    const hasSockets = (draggedNode?.sockets ?? []).some((s) => s.tag);
    const offset = computeSnapOffset({
      currentPos: [node.position.x, node.position.y, node.position.z],
      draggedFeatures: featureSnapPoints(node, scene, w, h),
      draggedSockets: socketPoints(node, draggedNode?.sockets ?? [], scene, w, h),
      hasSockets,
      targetFeatures: this.cachedTargets,
      targetSockets: this.cachedSocketTargets,
    });
    if (offset) {
      node.position.set(
        node.position.x + offset[0],
        node.position.y + offset[1],
        node.position.z + offset[2],
      );
    }
  }

  private onGizmoDragEnd(): void {
    const node = this.draggedNode();
    const start = this.dragStart;
    this.dragStart = null;
    this.setSelection(this.attachedNodeId); // restore outline hidden on drag start
    if (!node || !start) return;
    const nodeId = this.attachedNodeId;
    if (!nodeId) return;
    const end = captureTransform(node);
    if (transformsEqual(start, end)) return;
    this.commitCb?.(nodeId, start, end);
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("pointermove", this.onSnapPointer, true);
    window.removeEventListener("pointerdown", this.onSnapPointer, true);
    this.gizmoManager?.dispose();
    this.gizmoManager = null;
    this.commitCb = null;
    this.snapProvider = null;
    this.highlight?.dispose();
    this.highlight = null;
    this.camera?.dispose();
    this.camera = null;
    this.adapterInstance?.dispose();
    this.adapterInstance = null;
    this.babylonEngine = null;
  }
}
