import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_BEHAVIOR_ENABLED = "node.behavior.enabled.set" as const;

export interface SetBehaviorEnabledPayload extends Record<string, unknown> {
  node_id: string;
  binding_id: string;
  enabled: boolean;
  prev_enabled: boolean;
}

export interface SetBehaviorEnabledInput {
  node_id: string;
  binding_id: string;
  enabled: boolean;
  prev_enabled: boolean;
  id?: string;
  timestamp?: number;
}

export class SetBehaviorEnabledCommand implements Command {
  readonly id: string;
  readonly type = SET_BEHAVIOR_ENABLED;
  readonly timestamp: number;
  readonly payload: SetBehaviorEnabledPayload;

  constructor(input: SetBehaviorEnabledInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      binding_id: input.binding_id,
      enabled: input.enabled,
      prev_enabled: input.prev_enabled,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setBehaviorEnabled(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.enabled,
    );
  }

  revert(store: SceneEditorStore): void {
    store.setBehaviorEnabled(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.prev_enabled,
    );
  }

  canMergeWith(_other: Command): boolean {
    return false;
  }

  mergeWith(_other: Command): SetBehaviorEnabledCommand {
    throw new Error("SetBehaviorEnabledCommand: never merges");
  }
}
