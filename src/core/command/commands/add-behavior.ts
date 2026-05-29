import type { BehaviorBinding } from "@/core/scene/types";

import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const ADD_BEHAVIOR = "node.behavior.add" as const;

export interface AddBehaviorPayload extends Record<string, unknown> {
  node_id: string;
  binding: BehaviorBinding;
}

export interface AddBehaviorInput {
  node_id: string;
  binding: BehaviorBinding;
  id?: string;
  timestamp?: number;
}

export class AddBehaviorCommand implements Command {
  readonly id: string;
  readonly type = ADD_BEHAVIOR;
  readonly timestamp: number;
  readonly payload: AddBehaviorPayload;

  constructor(input: AddBehaviorInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = { node_id: input.node_id, binding: input.binding };
  }

  apply(store: SceneEditorStore): void {
    store.addBehavior(this.payload.node_id, this.payload.binding);
  }

  revert(store: SceneEditorStore): void {
    store.removeBehavior(this.payload.node_id, this.payload.binding.id);
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): AddBehaviorCommand {
    throw new Error("AddBehaviorCommand: never merges");
  }
}
