import type { SceneNode } from "@/core/scene/types";

import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const ADD_NODE = "node.add" as const;

export interface AddNodePayload extends Record<string, unknown> {
  node: SceneNode;
}

export interface AddNodeInput {
  node: SceneNode;
  id?: string;
  timestamp?: number;
}

/**
 * Adds a fully-formed SceneNode to the scene (apply → store.addNode). The node
 * carries its own id/parent_id, so revert is a subtree removal by that id —
 * symmetric because a freshly-added node has no children yet.
 */
export class AddNodeCommand implements Command {
  readonly id: string;
  readonly type = ADD_NODE;
  readonly timestamp: number;
  readonly payload: AddNodePayload;

  constructor(input: AddNodeInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = { node: input.node };
  }

  apply(store: SceneEditorStore): void {
    store.addNode(this.payload.node);
  }

  revert(store: SceneEditorStore): void {
    store.removeNodeSubtree(this.payload.node.id);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): AddNodeCommand {
    throw new Error("AddNodeCommand: never merges");
  }
}
