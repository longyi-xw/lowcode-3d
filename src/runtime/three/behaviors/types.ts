import type * as THREE from "three";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

/**
 * Runtime context passed to Behavior.install — lets event-driven behaviors
 * raycast + bind pointer listeners. `domElement` is null in non-viewport
 * contexts (tests / export-time codegen); event behaviors must no-op when
 * it's null.
 */
export interface BehaviorContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  domElement: HTMLElement | null;
  raycaster: THREE.Raycaster;
}

/**
 * Per-binding runtime state. Returned by Behavior.install, threaded through
 * tick, and released by handle.dispose (if present). For behaviors with no
 * persistent state (e.g. auto-rotate) install can return `{}` and tick never
 * reads handle.
 */
export interface BehaviorHandle {
  dispose?(): void;
}

/**
 * Single source of truth for a behavior: metadata, editor-runtime
 * (install/tick), and export codegen (emit) live on the same class. A future
 * cross-engine adapter (Babylon) would re-implement install/tick/emit against
 * its own runtime but share the same {@link BehaviorDefinition} metadata.
 *
 * Implementations are stateless — per-binding runtime state belongs in the
 * THandle so a single Behavior instance can serve many bindings (Flyweight).
 */
export interface Behavior<
  TParams = unknown,
  THandle extends BehaviorHandle = BehaviorHandle,
> {
  readonly definition: BehaviorDefinition;

  install(object: THREE.Object3D, params: TParams, ctx: BehaviorContext): THandle;

  /**
   * Optional per-frame update. Event-driven behaviors (e.g. hover-highlight)
   * omit this — they react to pointer events bound in install instead.
   */
  tick?(object: THREE.Object3D, params: TParams, handle: THandle, dt: number): void;

  /**
   * Returns a code block whose lines start at column 0. The scene-codegen
   * caller pushes the block via `pushBlock(ctx, code)`, which prefixes each
   * line with the current indent. The block may reference `tickers` /
   * `interactions` (arrays declared by the prolog) and the supplied `varName`.
   */
  emit(varName: string, params: TParams, ctx: CodegenContext): string;
}
