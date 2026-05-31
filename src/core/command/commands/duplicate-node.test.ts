import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";
import type { SceneNodeSnapshot } from "@/core/scene/snapshot";

import { DuplicateNodeCommand, DUPLICATE_NODE } from "./duplicate-node";
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

const newSubtree: SceneNodeSnapshot = {
  root: { ...group("new-a", "root"), name: "A Copy" },
  descendants: [],
  insert_index: 0,
};

describe("DuplicateNodeCommand", () => {
  it("apply calls duplicateNode with (source_node_id, new_subtree)", () => {
    const editor = makeFakeEditor();
    new DuplicateNodeCommand({
      source_node_id: "a",
      new_subtree: newSubtree,
    }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "duplicateNode", sourceNodeId: "a", newSubtree },
    ]);
  });

  it("revert calls removeNodeSubtree(new_subtree.root.id)", () => {
    const editor = makeFakeEditor();
    new DuplicateNodeCommand({
      source_node_id: "a",
      new_subtree: newSubtree,
    }).revert(editor);
    expect(editor.calls).toEqual([{ op: "removeNodeSubtree", nodeId: "new-a" }]);
  });

  it("type === DUPLICATE_NODE", () => {
    expect(
      new DuplicateNodeCommand({
        source_node_id: "a",
        new_subtree: newSubtree,
      }).type,
    ).toBe(DUPLICATE_NODE);
  });

  it("never merges", () => {
    const a = new DuplicateNodeCommand({
      source_node_id: "a",
      new_subtree: newSubtree,
    });
    const b = new DuplicateNodeCommand({
      source_node_id: "b",
      new_subtree: newSubtree,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
