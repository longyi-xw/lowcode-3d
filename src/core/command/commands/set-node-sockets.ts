import type { Socket } from "@/core/scene/types";

import { generateUUID } from "../../id/uuid";
import type { Command, SceneEditorStore } from "../types";

export const SET_NODE_SOCKETS = "node.sockets.set" as const;

/** Merge window for consecutive socket edits (rapid typing in the panel) —
 *  same rationale + value as SetNodeTransform / SetMaterialOverride. */
export const MERGE_WINDOW_MS = 500;

export interface SetNodeSocketsPayload extends Record<string, unknown> {
  node_id: string;
  sockets: Socket[];
  prev_sockets: Socket[];
}

export interface SetNodeSocketsInput {
  node_id: string;
  sockets: Socket[];
  prev_sockets: Socket[];
  id?: string;
  timestamp?: number;
}

export class SetNodeSocketsCommand implements Command {
  readonly id: string;
  readonly type = SET_NODE_SOCKETS;
  readonly timestamp: number;
  readonly payload: SetNodeSocketsPayload;

  constructor(input: SetNodeSocketsInput) {
    this.id = input.id ?? generateUUID();
    this.timestamp = input.timestamp ?? Date.now();
    this.payload = {
      node_id: input.node_id,
      sockets: input.sockets,
      prev_sockets: input.prev_sockets,
    };
  }

  apply(store: SceneEditorStore): void {
    store.setNodeSockets(this.payload.node_id, this.payload.sockets);
  }

  revert(store: SceneEditorStore): void {
    store.setNodeSockets(this.payload.node_id, this.payload.prev_sockets);
  }

  canMergeWith(other: Command): boolean {
    if (other.type !== SET_NODE_SOCKETS) return false;
    const o = other.payload as SetNodeSocketsPayload;
    if (o.node_id !== this.payload.node_id) return false;
    return Math.abs(other.timestamp - this.timestamp) < MERGE_WINDOW_MS;
  }

  mergeWith(other: Command): SetNodeSocketsCommand {
    if (!this.canMergeWith(other)) {
      throw new Error(
        `cannot merge ${this.type} with ${other.type}: node or window mismatch`,
      );
    }
    const o = other.payload as SetNodeSocketsPayload;
    return new SetNodeSocketsCommand({
      id: this.id,
      node_id: this.payload.node_id,
      sockets: o.sockets,
      prev_sockets: this.payload.prev_sockets,
      timestamp: other.timestamp,
    });
  }
}
