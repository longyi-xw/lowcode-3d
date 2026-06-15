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
 * Engine-neutral render host contract (v1.0 B1 subset: mount / render loop /
 * camera / resize / dispose). B2 extends it with picking + selection
 * highlight, B3 with the gizmo — converging ThreeViewport onto it per the
 * A1 spec §8 boundary list. B1's only implementation is BabylonRenderHost;
 * the Three side stays inside ThreeViewport untouched.
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
 * Capability gate: only the Three viewport supports editing interactions
 * (gizmo / play / drop / focus). Picking + selection highlight are cross-engine
 * since B2 (viewport-internal, not gated here). Every UI surface that disables
 * itself in Babylon mode reads this single helper, so B3/B4 flip capabilities
 * in one place instead of hunting scattered engine === "..." checks.
 */
export function isEngineEditingCapable(engine: ViewportEngine): boolean {
  return engine === "three.js";
}
