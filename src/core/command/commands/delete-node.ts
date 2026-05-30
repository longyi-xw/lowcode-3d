import type { SceneNodeSnapshot } from "@/core/scene/snapshot";
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const DELETE_NODE = "node.delete" as const;

export interface DeleteNodePayload extends Record<string, unknown> {
  node_id: string;
  prev_subtree: SceneNodeSnapshot;
}

export interface DeleteNodeInput {
  node_id: string;
  prev_subtree: SceneNodeSnapshot;
  id?: string;
  timestamp?: number;
}

export class DeleteNodeCommand implements Command {
  readonly id: string;
  readonly type = DELETE_NODE;
  readonly timestamp: number;
  readonly payload: DeleteNodePayload;

  constructor(input: DeleteNodeInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = { node_id: input.node_id, prev_subtree: input.prev_subtree };
  }

  apply(store: SceneEditorStore): void {
    store.removeNodeSubtree(this.payload.node_id);
  }

  revert(store: SceneEditorStore): void {
    store.restoreNodeSubtree(this.payload.prev_subtree);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): DeleteNodeCommand {
    throw new Error("DeleteNodeCommand: never merges");
  }
}
