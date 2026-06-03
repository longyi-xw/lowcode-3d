import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";

import { makeFakeEditor } from "./_test-utils";
import { ADD_NODE, AddNodeCommand } from "./add-node";

function meshNode(id = "n1"): SceneNode {
  return {
    id,
    name: "New Box",
    type: "mesh",
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", geometry: { kind: "box" } },
    behaviors: [],
    user_data: {},
  };
}

describe("AddNodeCommand", () => {
  it("apply() adds the node to the store", () => {
    const node = meshNode();
    const editor = makeFakeEditor();
    new AddNodeCommand({ node }).apply(editor);
    expect(editor.calls).toEqual([{ op: "addNode", node }]);
  });

  it("revert() removes the added subtree by node id", () => {
    const node = meshNode("abc");
    const editor = makeFakeEditor();
    new AddNodeCommand({ node }).revert(editor);
    expect(editor.calls).toEqual([{ op: "removeNodeSubtree", nodeId: "abc" }]);
  });

  it("never merges", () => {
    const cmd = new AddNodeCommand({ node: meshNode() });
    expect(cmd.canMergeWith(cmd)).toBe(false);
    expect(() => cmd.mergeWith(cmd)).toThrow();
  });

  it("uses a stable type + a JSON-serializable payload", () => {
    const node = meshNode();
    const cmd = new AddNodeCommand({ node, id: "cmd-1", timestamp: 5 });
    expect(cmd.type).toBe(ADD_NODE);
    expect(cmd.id).toBe("cmd-1");
    expect(JSON.parse(JSON.stringify(cmd.payload))).toEqual({ node });
  });
});
