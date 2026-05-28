import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_BEHAVIOR_PARAMETERS = "node.behavior.parameters.set" as const;
export const PARAMS_MERGE_WINDOW_MS = 500;

export interface SetBehaviorParametersPayload extends Record<string, unknown> {
  node_id: string;
  binding_id: string;
  parameters: Record<string, unknown>;
  prev_parameters: Record<string, unknown>;
}

export interface SetBehaviorParametersInput {
  node_id: string;
  binding_id: string;
  parameters: Record<string, unknown>;
  prev_parameters: Record<string, unknown>;
  id?: string;
  timestamp?: number;
}

export class SetBehaviorParametersCommand implements Command {
  readonly id: string;
  readonly type = SET_BEHAVIOR_PARAMETERS;
  readonly timestamp: number;
  readonly payload: SetBehaviorParametersPayload;

  constructor(input: SetBehaviorParametersInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      binding_id: input.binding_id,
      parameters: input.parameters,
      prev_parameters: input.prev_parameters,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setBehaviorParameters(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.parameters,
    );
  }

  revert(store: SceneEditorStore): void {
    store.setBehaviorParameters(
      this.payload.node_id,
      this.payload.binding_id,
      this.payload.prev_parameters,
    );
  }

  canMergeWith(other: Command): boolean {
    if (other.type !== SET_BEHAVIOR_PARAMETERS) return false;
    const otherPayload = other.payload as SetBehaviorParametersPayload;
    if (otherPayload.binding_id !== this.payload.binding_id) return false;
    if (otherPayload.node_id !== this.payload.node_id) return false;
    return Math.abs(other.timestamp - this.timestamp) < PARAMS_MERGE_WINDOW_MS;
  }

  mergeWith(other: Command): SetBehaviorParametersCommand {
    if (!this.canMergeWith(other)) {
      throw new Error(
        "SetBehaviorParametersCommand: cannot merge — binding_id or window mismatch",
      );
    }
    const otherPayload = other.payload as SetBehaviorParametersPayload;
    return new SetBehaviorParametersCommand({
      id: this.id,
      node_id: this.payload.node_id,
      binding_id: this.payload.binding_id,
      parameters: otherPayload.parameters,
      prev_parameters: this.payload.prev_parameters,
      timestamp: other.timestamp,
    });
  }
}
