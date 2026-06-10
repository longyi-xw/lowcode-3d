import type { Node as BabylonNode } from "@babylonjs/core";

import type { BehaviorDefinition } from "@/runtime/adapter";

/** Per-binding runtime state (bob keeps base+elapsed; auto-rotate keeps none). */
export interface BabylonBehaviorHandle {
  dispose?(): void;
}

/**
 * Babylon-side behavior: shares the engine-neutral BehaviorDefinition metadata
 * with the Three implementation, re-implements install/tick against a Babylon
 * node. No emit (codegen) in A2 — that's A3. Stateless (Flyweight): per-binding
 * state lives in THandle so one instance serves many bindings.
 */
export interface BabylonBehavior<
  TParams = unknown,
  THandle extends BabylonBehaviorHandle = BabylonBehaviorHandle,
> {
  readonly definition: BehaviorDefinition;
  install(node: BabylonNode, params: TParams): THandle;
  tick?(node: BabylonNode, params: TParams, handle: THandle, dt: number): void;
}
