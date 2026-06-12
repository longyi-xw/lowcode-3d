import type { RuntimeTarget } from "@/core/scene/types";

/** Engines the editor viewport can render with — the subset of RuntimeTarget
 *  kinds that have a render-host implementation. */
export type ViewportEngine = Extract<RuntimeTarget["kind"], "three.js" | "babylon.js">;

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
