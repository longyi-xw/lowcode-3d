import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";
import type { SceneNodeSnapshot } from "@/core/scene/snapshot";

import { DeleteNodeCommand, DELETE_NODE } from "./delete-node";
import { makeFakeEditor } from "./_test-utils";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function group(id: string, parent: string | null = null): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform: IDENTITY,
    parent_id: parent,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
  };
}

const snapshot: SceneNodeSnapshot = {
  root: group("a", "root"),
  descendants: [group("a1", "a")],
  insert_index: 0,
};

describe("DeleteNodeCommand", () => {
  it("apply calls removeNodeSubtree(node_id)", () => {
    const editor = makeFakeEditor();
    new DeleteNodeCommand({ node_id: "a", prev_subtree: snapshot }).apply(editor);
    expect(editor.calls).toEqual([{ op: "removeNodeSubtree", nodeId: "a" }]);
  });

  it("revert calls restoreNodeSubtree(prev_subtree)", () => {
    const editor = makeFakeEditor();
    new DeleteNodeCommand({ node_id: "a", prev_subtree: snapshot }).revert(editor);
    expect(editor.calls).toEqual([{ op: "restoreNodeSubtree", snapshot }]);
  });

  it("type === DELETE_NODE", () => {
    expect(new DeleteNodeCommand({ node_id: "a", prev_subtree: snapshot }).type).toBe(
      DELETE_NODE,
    );
  });

  it("never merges", () => {
    const a = new DeleteNodeCommand({ node_id: "a", prev_subtree: snapshot });
    const b = new DeleteNodeCommand({ node_id: "b", prev_subtree: snapshot });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
