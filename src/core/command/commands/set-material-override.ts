import type { MaterialOverride } from "@/core/scene/material";

import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_MATERIAL_OVERRIDE = "node.material.set" as const;

/** Merge window for consecutive material edits (e.g. dragging a slider at
 *  60fps) — same rationale + value as SetNodeTransform. */
export const MERGE_WINDOW_MS = 500;

export interface SetMaterialOverridePayload extends Record<string, unknown> {
  node_id: string;
  override: MaterialOverride | undefined;
  prev_override: MaterialOverride | undefined;
}

export interface SetMaterialOverrideInput {
  node_id: string;
  override: MaterialOverride | undefined;
  prev_override: MaterialOverride | undefined;
  id?: string;
  timestamp?: number;
}

export class SetMaterialOverrideCommand implements Command {
  readonly id: string;
  readonly type = SET_MATERIAL_OVERRIDE;
  readonly timestamp: number;
  readonly payload: SetMaterialOverridePayload;

  constructor(input: SetMaterialOverrideInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      override: input.override,
      prev_override: input.prev_override,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setMeshMaterial(this.payload.node_id, this.payload.override);
  }

  revert(store: SceneEditorStore): void {
    store.setMeshMaterial(this.payload.node_id, this.payload.prev_override);
  }

  canMergeWith(other: Command): boolean {
    if (other.type !== SET_MATERIAL_OVERRIDE) return false;
    const o = other.payload as SetMaterialOverridePayload;
    if (o.node_id !== this.payload.node_id) return false;
    return Math.abs(other.timestamp - this.timestamp) < MERGE_WINDOW_MS;
  }

  mergeWith(other: Command): SetMaterialOverrideCommand {
    if (!this.canMergeWith(other)) {
      throw new Error(
        `cannot merge ${this.type} with ${other.type}: node or window mismatch`,
      );
    }
    const o = other.payload as SetMaterialOverridePayload;
    // earliest prev (revert to gesture start) + latest override (current).
    return new SetMaterialOverrideCommand({
      id: this.id,
      node_id: this.payload.node_id,
      override: o.override,
      prev_override: this.payload.prev_override,
      timestamp: other.timestamp,
    });
  }
}
