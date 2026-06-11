import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HighlightLayer,
  Mesh,
  Vector3,
  type AbstractEngine,
  type Node as BabylonNode,
} from "@babylonjs/core";

import type { IRenderHost } from "@/runtime/render-host";

import { BabylonAdapter } from "./adapter";

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

  dispose(): void {
    this.stop();
    this.highlight?.dispose();
    this.highlight = null;
    this.camera?.dispose();
    this.camera = null;
    this.adapterInstance?.dispose();
    this.adapterInstance = null;
    this.babylonEngine = null;
  }
}
