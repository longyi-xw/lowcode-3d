import type { BehaviorBinding } from "@/core/scene/types";

import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const REMOVE_BEHAVIOR = "node.behavior.remove" as const;

export interface RemoveBehaviorPayload extends Record<string, unknown> {
  node_id: string;
  prev_binding: BehaviorBinding;
}

export interface RemoveBehaviorInput {
  node_id: string;
  prev_binding: BehaviorBinding;
  id?: string;
  timestamp?: number;
}

export class RemoveBehaviorCommand implements Command {
  readonly id: string;
  readonly type = REMOVE_BEHAVIOR;
  readonly timestamp: number;
  readonly payload: RemoveBehaviorPayload;

  constructor(input: RemoveBehaviorInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      prev_binding: input.prev_binding,
    };
  }

  apply(store: SceneEditorStore): void {
    store.removeBehavior(this.payload.node_id, this.payload.prev_binding.id);
  }

  revert(store: SceneEditorStore): void {
    store.addBehavior(this.payload.node_id, this.payload.prev_binding);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): RemoveBehaviorCommand {
    throw new Error("RemoveBehaviorCommand: never merges");
  }
}
