import type { BehaviorBinding, SceneNode, Transform } from "@/core/scene/types";
import type { SceneNodeSnapshot } from "@/core/scene/snapshot";

import type { SceneEditorStore } from "../types";

type Call =
  | { op: "addBehavior"; nodeId: string; binding: BehaviorBinding }
  | { op: "removeBehavior"; nodeId: string; bindingId: string }
  | {
      op: "setBehaviorEnabled";
      nodeId: string;
      bindingId: string;
      enabled: boolean;
    }
  | {
      op: "setBehaviorParameters";
      nodeId: string;
      bindingId: string;
      parameters: Record<string, unknown>;
    }
  | { op: "setNodeTransform"; id: string; transform: Transform }
  | { op: "removeNodeSubtree"; nodeId: string }
  | { op: "restoreNodeSubtree"; snapshot: SceneNodeSnapshot }
  | {
      op: "duplicateNode";
      sourceNodeId: string;
      newSubtree: SceneNodeSnapshot;
    };

export type FakeEditor = SceneEditorStore & { calls: Call[] };

export function makeFakeEditor(node?: SceneNode): FakeEditor {
  const calls: Call[] = [];
  return {
    calls,
    getNode: () => node,
    setNodeTransform: (id, transform) =>
      calls.push({ op: "setNodeTransform", id, transform }),
    addBehavior: (nodeId, binding) =>
      calls.push({ op: "addBehavior", nodeId, binding }),
    removeBehavior: (nodeId, bindingId) =>
      calls.push({ op: "removeBehavior", nodeId, bindingId }),
    setBehaviorEnabled: (nodeId, bindingId, enabled) =>
      calls.push({ op: "setBehaviorEnabled", nodeId, bindingId, enabled }),
    setBehaviorParameters: (nodeId, bindingId, parameters) =>
      calls.push({
        op: "setBehaviorParameters",
        nodeId,
        bindingId,
        parameters,
      }),
    removeNodeSubtree: (nodeId) => calls.push({ op: "removeNodeSubtree", nodeId }),
    restoreNodeSubtree: (snapshot) =>
      calls.push({ op: "restoreNodeSubtree", snapshot }),
    duplicateNode: (sourceNodeId, newSubtree) =>
      calls.push({ op: "duplicateNode", sourceNodeId, newSubtree }),
  };
}
