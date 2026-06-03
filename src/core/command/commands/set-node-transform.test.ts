import { describe, expect, it } from "vitest";

import type { SceneNode, Transform } from "../../scene/types";
import type { SceneEditorStore } from "../types";
import {
  MERGE_WINDOW_MS,
  SET_NODE_TRANSFORM,
  SetNodeTransformCommand,
} from "./set-node-transform";

const identity: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function makeNode(id: string, transform: Transform = identity): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
  };
}

interface TestStore extends SceneEditorStore {
  currentTransform(id: string): Transform | undefined;
}

function createTestStore(...nodes: SceneNode[]): TestStore {
  const map = new Map<string, SceneNode>();
  for (const n of nodes) map.set(n.id, n);
  return {
    getNode: (id) => map.get(id),
    setNodeTransform: (id, transform) => {
      const n = map.get(id);
      if (n) map.set(id, { ...n, transform });
    },
    addBehavior: () => {
      throw new Error("addBehavior not implemented in this fake");
    },
    removeBehavior: () => {
      throw new Error("removeBehavior not implemented in this fake");
    },
    setBehaviorEnabled: () => {
      throw new Error("setBehaviorEnabled not implemented in this fake");
    },
    setBehaviorParameters: () => {
      throw new Error("setBehaviorParameters not implemented in this fake");
    },
    addNode: () => {
      throw new Error("addNode not implemented in this fake");
    },
    removeNodeSubtree: () => {
      throw new Error("removeNodeSubtree not implemented in this fake");
    },
    restoreNodeSubtree: () => {
      throw new Error("restoreNodeSubtree not implemented in this fake");
    },
    duplicateNode: () => {
      throw new Error("duplicateNode not implemented in this fake");
    },
    currentTransform: (id) => map.get(id)?.transform,
  };
}

describe("SetNodeTransformCommand", () => {
  it("declares the expected type identifier", () => {
    expect(SET_NODE_TRANSFORM).toBe("node.transform.set");
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: identity,
      prev_transform: identity,
    });
    expect(cmd.type).toBe("node.transform.set");
  });

  it("apply + revert is symmetric", () => {
    const target: Transform = {
      position: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      scale: [2, 2, 2],
    };
    const store = createTestStore(makeNode("n1", identity));
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: target,
      prev_transform: identity,
    });

    cmd.apply(store);
    expect(store.currentTransform("n1")).toEqual(target);

    cmd.revert(store);
    expect(store.currentTransform("n1")).toEqual(identity);
  });

  it("payload is JSON-serializable round-trip", () => {
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: identity,
      prev_transform: identity,
    });
    const cloned = JSON.parse(JSON.stringify(cmd.payload));
    expect(cloned).toEqual(cmd.payload);
  });

  it("auto-generates a v4 uuid id when none is provided", () => {
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: identity,
      prev_transform: identity,
    });
    expect(cmd.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("respects an explicit id and timestamp", () => {
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: identity,
      prev_transform: identity,
      id: "fixed-id",
      timestamp: 42,
    });
    expect(cmd.id).toBe("fixed-id");
    expect(cmd.timestamp).toBe(42);
  });
});

describe("SetNodeTransformCommand merging", () => {
  const t0: Transform = identity;
  const t1: Transform = { ...identity, position: [1, 0, 0] };
  const t2: Transform = { ...identity, position: [2, 0, 0] };

  it("merges two commands on the same node within the time window", () => {
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 1000,
    });
    const c2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t2,
      prev_transform: t1,
      timestamp: 1000 + MERGE_WINDOW_MS - 1,
    });

    expect(c1.canMergeWith(c2)).toBe(true);
    const merged = c1.mergeWith(c2);

    expect(merged.payload.prev_transform).toEqual(t0);
    expect(merged.payload.transform).toEqual(t2);
    expect(merged.id).toBe(c1.id);
    expect(merged.timestamp).toBe(c2.timestamp);
  });

  it("merged command reverts all the way to the original transform", () => {
    const store = createTestStore(makeNode("n1", t0));
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 1000,
    });
    c1.apply(store);
    const c2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t2,
      prev_transform: t1,
      timestamp: 1100,
    });
    c2.apply(store);
    expect(store.currentTransform("n1")).toEqual(t2);

    const merged = c1.mergeWith(c2);
    merged.revert(store);
    expect(store.currentTransform("n1")).toEqual(t0);
  });

  it("refuses to merge across different node ids", () => {
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 0,
    });
    const c2 = new SetNodeTransformCommand({
      node_id: "n2",
      transform: t1,
      prev_transform: t0,
      timestamp: 100,
    });
    expect(c1.canMergeWith(c2)).toBe(false);
    expect(() => c1.mergeWith(c2)).toThrow();
  });

  it("refuses to merge outside the time window", () => {
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 0,
    });
    const c2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t2,
      prev_transform: t1,
      timestamp: MERGE_WINDOW_MS + 1,
    });
    expect(c1.canMergeWith(c2)).toBe(false);
  });

  it("refuses to merge a different command type", () => {
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 0,
    });
    const other = {
      id: "x",
      type: "node.visibility.set",
      timestamp: 1,
      payload: {} as Record<string, unknown>,
      apply: () => {},
      revert: () => {},
      canMergeWith: () => false,
      mergeWith: () => other,
    };
    expect(c1.canMergeWith(other)).toBe(false);
  });
});
