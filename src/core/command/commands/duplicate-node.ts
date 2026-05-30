import type { SceneNodeSnapshot } from "@/core/scene/snapshot";
import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const DUPLICATE_NODE = "node.duplicate" as const;

export interface DuplicateNodePayload extends Record<string, unknown> {
  source_node_id: string;
  new_subtree: SceneNodeSnapshot;
}

export interface DuplicateNodeInput {
  source_node_id: string;
  new_subtree: SceneNodeSnapshot;
  id?: string;
  timestamp?: number;
}

export class DuplicateNodeCommand implements Command {
  readonly id: string;
  readonly type = DUPLICATE_NODE;
  readonly timestamp: number;
  readonly payload: DuplicateNodePayload;

  constructor(input: DuplicateNodeInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      source_node_id: input.source_node_id,
      new_subtree: input.new_subtree,
    };
  }

  apply(store: SceneEditorStore): void {
    store.duplicateNode(this.payload.source_node_id, this.payload.new_subtree);
  }

  revert(store: SceneEditorStore): void {
    store.removeNodeSubtree(this.payload.new_subtree.root.id);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): DuplicateNodeCommand {
    throw new Error("DuplicateNodeCommand: never merges");
  }
}
