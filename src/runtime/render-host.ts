import type { RuntimeTarget, SceneNode, Socket, Transform } from "@/core/scene/types";
import type { GizmoMode } from "@/core/editor-types";

/** Engines the editor viewport can render with — the subset of RuntimeTarget
 *  kinds that have a render-host implementation. */
export type ViewportEngine = Extract<RuntimeTarget["kind"], "three.js" | "babylon.js">;

/** Minimal per-node info the host pulls (via setSnapProvider) at drag start to
 *  cache snap targets — store-agnostic so the host never imports Zustand. */
export interface SnapNode {
  id: string;
  sockets: readonly Socket[];
  visible: boolean;
  type: SceneNode["type"];
}

/**
 * Engine-neutral render host contract. Grown incrementally: B1 = mount /
 * render loop / camera / resize / dispose; B2 = picking + selection highlight;
 * B3a = gizmo + snap (setGizmoMode / setGizmoTarget / onTransformCommit /
 * setSnapProvider), defined by extracting the mature Three implementation.
 * Implementations: ThreeRenderHost (full) and BabylonRenderHost (gizmo+snap
 * are no-op stubs until B3b adds the Babylon GizmoManager).
 *
 * Call order: mount → start → (resize/stop/start)* → dispose. An instance is
 * not reusable after dispose.
 */
export interface IRenderHost {
  readonly engine: ViewportEngine;
  /** Create the real engine + editor camera + camera controls on the canvas. */
  mount(canvas: HTMLCanvasElement): void;
  start(): void;
  stop(): void;
  resize(width: number, height: number): void;
  /** Mark the node as visually selected (engine-specific highlight), or
   *  clear the marker when null. Idempotent — callers may replay it after
   *  scene diffs (removed/rebuilt nodes must not leave stale highlights). */
  setSelection(node_id: string | null): void;
  /** Set the transform gizmo manipulation mode. */
  setGizmoMode(mode: GizmoMode): void;
  /** Attach the gizmo to a node (null = detach). `locked` → outline only,
   *  no attach (prevents drag-editing locked/editor-chrome nodes). */
  setGizmoTarget(node_id: string | null, locked: boolean): void;
  /** Register the commit sink — the host calls it once per completed drag
   *  (mouseUp with a changed transform). The viewport wires it to the command
   *  history; the host stays command-agnostic. */
  onTransformCommit(
    cb: (node_id: string, prev: Transform, next: Transform) => void,
  ): void;
  /** Inject the scene snapshot provider the host pulls at drag start to cache
   *  snap targets. Keeps the host free of store imports. */
  setSnapProvider(provider: () => SnapNode[]): void;
  dispose(): void;
}

/**
 * Per-engine editing capability flags. B1/B2 gated everything behind a single
 * "three-only" boolean; B3b splits it so Babylon can enable the gizmo while
 * play / focus / asset-drop stay Three-only until B4 implements them. B4 flips
 * the remaining flags here in one place.
 */
export interface EngineCapabilities {
  /** Transform gizmo + snap (B3b: both engines). */
  gizmo: boolean;
  /** Play/pause behavior preview (B4: Three-only). */
  play: boolean;
  /** F-to-focus camera (B4: Three-only). */
  focus: boolean;
  /** Drag library assets into the viewport (B4: Three-only). */
  assetDrop: boolean;
}

export function engineCapabilities(engine: ViewportEngine): EngineCapabilities {
  void engine; // both engines reach full editing parity at B4c; kept as the
  // capability-gate seam for future v1.x engines (r3f / Unity) that may not.
  return { gizmo: true, play: true, focus: true, assetDrop: true };
}
