import {
  ArcRotateCamera,
  Color3,
  Color4,
  CubeTexture,
  Engine,
  GizmoManager,
  HighlightLayer,
  ImageProcessingPostProcess,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractEngine,
  type Node as BabylonNode,
} from "@babylonjs/core";

import neutralEnvUrl from "@/assets/env/neutral.env?url";

import { SOCKET_MARKER } from "@/runtime/socket-markers";

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
  private frameCb: ((dt: number) => void) | null = null;

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
  // Babylon's AxisDragGizmo moves the node incrementally (position += delta).
  // `dragUnsnapped` accumulates those deltas to track the true cumulative
  // pointer position; `lastSnappedPos` is what we last wrote to node.position,
  // used to recover each frame's delta. Without this the snap correction feeds
  // back into the next gizmo delta and the node sticks to / jitters around
  // targets. Both null outside a drag.
  private dragUnsnapped: Vector3 | null = null;
  private lastSnappedPos: Vector3 | null = null;
  private cachedTargets: ReturnType<typeof featureSnapPoints> = [];
  private cachedSocketTargets: ReturnType<typeof socketPoints> = [];
  private imageProcessing: ImageProcessingPostProcess | null = null;
  private envTexture: CubeTexture | null = null;
  private socketMarkers: TransformNode | null = null;
  private socketMat: StandardMaterial | null = null;
  private socketMatSel: StandardMaterial | null = null;
  private currentSelectionId: string | null = null;
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

  /** Test-only surface: lets unit tests assert the socket-marker overlay. */
  get socketMarkersForTest(): TransformNode | null {
    return this.socketMarkers;
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

    // sRGB output (B4d) — match Three's OutputPass, which sRGB-encodes the whole
    // frame (incl. the dark clearColor). applyByPostProcess=true moves image
    // processing to a fullscreen post-process so the background gets the gamma
    // curve too AND materials defer to it (no double-encode). NoToneMapping
    // (Babylon default toneMappingEnabled=false) matches Three's default.
    const ip = scene.imageProcessingConfiguration;
    ip.isEnabled = true;
    ip.applyByPostProcess = true;
    this.imageProcessing = new ImageProcessingPostProcess(
      "imageProcessing",
      1.0,
      camera,
    );

    // Neutral IBL (B4d) — both engines were env-less, so PBR metals read dark.
    // A small neutral studio .env gives metals something to reflect; Three uses
    // RoomEnvironment for the parallel effect. Not pixel-identical across
    // engines (different convolution) — both just neutral.
    this.envTexture = CubeTexture.CreateFromPrefilteredData(neutralEnvUrl, scene);
    scene.environmentTexture = this.envTexture;

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

    // Socket-marker overlay (B4b) — host-owned, mirrors ThreeRenderHost. Unlit
    // emissive spheres so they read regardless of scene lighting; isPickable=
    // false keeps them out of pickAt. Shared materials, named for test asserts.
    this.socketMarkers = new TransformNode("socketMarkers", scene);
    const mkMat = new StandardMaterial("socket-mat", scene);
    mkMat.disableLighting = true;
    mkMat.emissiveColor = Color3.FromHexString(SOCKET_MARKER.color);
    this.socketMat = mkMat;
    const mkMatSel = new StandardMaterial("socket-mat-sel", scene);
    mkMatSel.disableLighting = true;
    mkMatSel.emissiveColor = Color3.FromHexString(SOCKET_MARKER.colorSelected);
    this.socketMatSel = mkMatSel;

    window.addEventListener("pointermove", this.onSnapPointer, true);
    window.addEventListener("pointerdown", this.onSnapPointer, true);
  }

  start(): void {
    const engine = this.babylonEngine;
    const scene = this.adapterInstance?.scene;
    if (!engine || !scene) return;
    engine.runRenderLoop(() => {
      this.frameCb?.(engine.getDeltaTime() / 1000); // ms → seconds (tickBehaviors expects seconds)
      scene.render();
    });
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
    this.currentSelectionId = node_id;
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

  syncSocketMarkers(): void {
    this.rebuildSocketMarkers();
  }

  /** Rebuild the overlay from the snap provider + current selection. Disposes
   *  prior marker meshes (Babylon meshes need explicit dispose, unlike Three's
   *  shared-geo group.clear). Mirrors ThreeRenderHost.rebuildSocketMarkers. */
  private rebuildSocketMarkers(): void {
    const overlay = this.socketMarkers;
    const adapter = this.adapterInstance;
    const mat = this.socketMat;
    const matSel = this.socketMatSel;
    if (!overlay || !adapter || !mat || !matSel) return;
    for (const child of overlay.getChildMeshes()) child.dispose();
    const selId = this.currentSelectionId;
    for (const n of this.snapProvider?.() ?? []) {
      if (!n.sockets || n.sockets.length === 0) continue;
      const node = adapter.getRuntimeObject(n.id) as BabylonNode | undefined;
      if (!node) continue;
      node.computeWorldMatrix(true);
      const world = node.getWorldMatrix();
      for (const s of n.sockets) {
        const mk = MeshBuilder.CreateSphere(
          "socketMarker",
          { diameter: SOCKET_MARKER.radius * 2, segments: 8 },
          adapter.scene,
        );
        mk.parent = overlay;
        mk.isPickable = false;
        mk.material = n.id === selId ? matSel : mat;
        mk.position = Vector3.TransformCoordinates(
          new Vector3(s.position[0], s.position[1], s.position[2]),
          world,
        );
      }
    }
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
    const [px, py, pz] = this.dragStart.position;
    this.dragUnsnapped = new Vector3(px, py, pz);
    this.lastSnappedPos = new Vector3(px, py, pz);
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
    const base = this.dragUnsnapped;
    const last = this.lastSnappedPos;
    if (!node || this.gizmoMode !== "translate" || !base || !last) return;
    // The gizmo applied its pointer delta to node.position (position += delta)
    // since our last write. Fold that delta into the unsnapped base so snapping
    // evaluates the true cumulative pointer position, not the previously-snapped
    // one — otherwise the node sticks to / jitters around targets ("drifting").
    base.addInPlace(node.position.subtract(last));
    const finish = () => {
      last.copyFrom(node.position);
      node.computeWorldMatrix(true); // keep the world matrix in sync with our write
      this.rebuildSocketMarkers();
    };
    if (!this.snapModifierDown) {
      node.position.copyFrom(base); // free drag: no snap, but keep base tracking
      finish();
      return;
    }
    const scene = this.adapterInstance?.scene;
    if (!scene) {
      finish();
      return;
    }
    const [w, h] = this.viewportSize();
    node.position.copyFrom(base); // project features at the unsnapped base
    const draggedNode = this.snapProvider?.().find((n) => n.id === this.attachedNodeId);
    const hasSockets = (draggedNode?.sockets ?? []).some((s) => s.tag);
    const offset = computeSnapOffset({
      currentPos: [base.x, base.y, base.z],
      draggedFeatures: featureSnapPoints(node, scene, w, h),
      draggedSockets: socketPoints(node, draggedNode?.sockets ?? [], scene, w, h),
      hasSockets,
      targetFeatures: this.cachedTargets,
      targetSockets: this.cachedSocketTargets,
    });
    if (offset) {
      node.position.set(base.x + offset[0], base.y + offset[1], base.z + offset[2]);
    }
    finish();
  }

  // ── Engine-specific surface (B4c) ──

  /** Engine-specific surface — per-frame hook so the viewport can tick play
   *  behaviors without the host knowing about play state (mirrors
   *  ThreeRenderHost.setFrameCallback). The callback receives elapsed time in
   *  seconds (Babylon getDeltaTime() returns ms, divided here). */
  setFrameCallback(cb: ((dt: number) => void) | null): void {
    this.frameCb = cb;
  }

  /** Engine-specific surface — F-focus moves the ArcRotate camera to center
   *  `target` at `distance` (mirrors ThreeRenderHost.focusCamera). */
  focusCamera(target: Vector3, distance: number): void {
    const cam = this.camera;
    if (!cam) return;
    cam.setTarget(target);
    cam.radius = distance;
  }

  private onGizmoDragEnd(): void {
    const node = this.draggedNode();
    const start = this.dragStart;
    this.dragStart = null;
    this.dragUnsnapped = null;
    this.lastSnappedPos = null;
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
    this.imageProcessing?.dispose();
    this.imageProcessing = null;
    this.envTexture?.dispose();
    this.envTexture = null;
    this.gizmoManager?.dispose();
    this.gizmoManager = null;
    this.commitCb = null;
    this.snapProvider = null;
    this.frameCb = null;
    this.dragUnsnapped = null;
    this.lastSnappedPos = null;
    this.socketMat?.dispose();
    this.socketMatSel?.dispose();
    this.socketMarkers?.dispose(); // TransformNode.dispose cascades to child markers
    this.socketMat = null;
    this.socketMatSel = null;
    this.socketMarkers = null;
    this.currentSelectionId = null;
    this.highlight?.dispose();
    this.highlight = null;
    this.camera?.dispose();
    this.camera = null;
    this.adapterInstance?.dispose();
    this.adapterInstance = null;
    this.babylonEngine = null;
  }
}
