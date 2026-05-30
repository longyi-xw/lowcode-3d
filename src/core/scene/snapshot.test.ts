import { describe, expect, it } from "vitest";

import type { SceneGraph, SceneNode } from "./types";

import { snapshotIds, snapshotSubtree } from "./snapshot";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function group(id: string, parent: string | null, children: string[]): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform: IDENTITY,
    parent_id: parent,
    children_ids: children,
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
  };
}

describe("snapshotSubtree", () => {
  it("captures a leaf with no descendants", () => {
    const scene: SceneGraph = {
      root_node_ids: ["a"],
      nodes: { a: group("a", null, []) },
    };
    const snap = snapshotSubtree(scene, "a");
    expect(snap.root.id).toBe("a");
    expect(snap.descendants).toEqual([]);
    expect(snap.insert_index).toBe(0);
  });

  it("captures depth-first descendants", () => {
    const scene: SceneGraph = {
      root_node_ids: ["root"],
      nodes: {
        root: group("root", null, ["a", "b"]),
        a: group("a", "root", ["a1"]),
        a1: group("a1", "a", []),
        b: group("b", "root", []),
      },
    };
    const snap = snapshotSubtree(scene, "root");
    expect(snap.descendants.map((n) => n.id)).toEqual(["a", "a1", "b"]);
  });

  it("records insert_index relative to root_node_ids when parent is null", () => {
    const scene: SceneGraph = {
      root_node_ids: ["a", "b", "c"],
      nodes: {
        a: group("a", null, []),
        b: group("b", null, []),
        c: group("c", null, []),
      },
    };
    expect(snapshotSubtree(scene, "b").insert_index).toBe(1);
  });

  it("records insert_index relative to parent.children_ids", () => {
    const scene: SceneGraph = {
      root_node_ids: ["root"],
      nodes: {
        root: group("root", null, ["a", "b", "c"]),
        a: group("a", "root", []),
        b: group("b", "root", []),
        c: group("c", "root", []),
      },
    };
    expect(snapshotSubtree(scene, "c").insert_index).toBe(2);
  });

  it("throws on unknown root id", () => {
    const scene: SceneGraph = { root_node_ids: [], nodes: {} };
    expect(() => snapshotSubtree(scene, "missing")).toThrow(/unknown node/);
  });
});

describe("snapshotIds", () => {
  it("returns root + every descendant id as a Set", () => {
    const scene: SceneGraph = {
      root_node_ids: ["r"],
      nodes: {
        r: group("r", null, ["a"]),
        a: group("a", "r", ["a1"]),
        a1: group("a1", "a", []),
      },
    };
    const ids = snapshotIds(snapshotSubtree(scene, "r"));
    expect([...ids].sort()).toEqual(["a", "a1", "r"]);
  });
});
