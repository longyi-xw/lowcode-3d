import type { Transform } from "../../scene/types";
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_NODE_TRANSFORM = "node.transform.set" as const;

/** Window during which two consecutive SetNodeTransform commands on the same
 *  node merge into a single undo entry. Tuned for a typical mouse drag at
 *  60 fps (~16ms per move); 500ms catches the pause between intentional
 *  edits and the bursty edits from a single gesture. */
export const MERGE_WINDOW_MS = 500;

export interface SetNodeTransformPayload extends Record<string, unknown> {
  node_id: string;
  transform: Transform;
  prev_transform: Transform;
}

export interface SetNodeTransformInput {
  node_id: string;
  transform: Transform;
  prev_transform: Transform;
  id?: string;
  timestamp?: number;
}

export class SetNodeTransformCommand implements Command {
  readonly id: string;
  readonly type = SET_NODE_TRANSFORM;
  readonly timestamp: number;
  readonly payload: SetNodeTransformPayload;

  constructor(input: SetNodeTransformInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      transform: input.transform,
      prev_transform: input.prev_transform,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setNodeTransform(this.payload.node_id, this.payload.transform);
  }

  revert(store: SceneEditorStore): void {
    store.setNodeTransform(this.payload.node_id, this.payload.prev_transform);
  }

  canMergeWith(other: Command): boolean {
    if (other.type !== SET_NODE_TRANSFORM) return false;
    const otherPayload = other.payload as SetNodeTransformPayload;
    if (otherPayload.node_id !== this.payload.node_id) return false;
    return Math.abs(other.timestamp - this.timestamp) < MERGE_WINDOW_MS;
  }

  mergeWith(other: Command): SetNodeTransformCommand {
    if (!this.canMergeWith(other)) {
      throw new Error(
        `cannot merge ${this.type} with ${other.type}: ` +
          `node_id or time-window mismatch`,
      );
    }
    const otherPayload = other.payload as SetNodeTransformPayload;
    // Earliest prev_transform (so revert returns to where the gesture began)
    // + latest transform (current state at merge time). Reuse this.id so the
    // undo stack does not grow during a continuous drag.
    return new SetNodeTransformCommand({
      id: this.id,
      node_id: this.payload.node_id,
      transform: otherPayload.transform,
      prev_transform: this.payload.prev_transform,
      timestamp: other.timestamp,
    });
  }
}
