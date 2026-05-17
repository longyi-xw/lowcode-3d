import type { SceneNode, Transform } from "../scene/types";

/**
 * The minimal slice of editor state a scene-editing Command interacts with.
 * The full editor store (Zustand-backed) lands in Phase 1 alongside Three.js
 * adapter wiring; this narrow interface keeps Command testable in isolation.
 */
export interface SceneEditorStore {
  getNode(id: string): SceneNode | undefined;
  setNodeTransform(id: string, transform: Transform): void;
}

/**
 * Editor command — see architecture.md §4.2.
 *
 * Requirements:
 * - Every parameter must be pure data so a Command can be JSON-serialized.
 *   This is what makes future AI invocation, macro recording, and
 *   collaboration sync possible later.
 * - apply/revert MUST be symmetric: calling revert after apply must return
 *   the store to a state indistinguishable from before apply.
 * - canMergeWith/mergeWith collapse a burst of related edits (e.g. one drag
 *   producing N transform changes) into a single undo entry.
 */
export interface Command {
  readonly id: string;
  /** Stable string identifying the command kind. Convention: dotted path
   *  matching the operation, e.g. "node.transform.set". */
  readonly type: string;
  readonly timestamp: number;
  /** Pure-data parameters. Must be JSON-serializable. */
  readonly payload: Record<string, unknown>;

  apply(store: SceneEditorStore): void;
  revert(store: SceneEditorStore): void;

  canMergeWith(other: Command): boolean;
  mergeWith(other: Command): Command;
}
