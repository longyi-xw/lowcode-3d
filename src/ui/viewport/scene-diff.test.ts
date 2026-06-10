import { describe, expect, it } from "vitest";

import type { SceneGraph, SceneNode } from "@/core/scene/types";

import { diffSceneNodes, EMPTY_SCENE_GRAPH } from "./scene-diff";

const ID_TRANSFORM = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};
const baseFields = {
  children_ids: [] as string[],
  visible: true,
  locked: false,
  behaviors: [],
  user_data: {},
};

function node(
  partial: Pick<SceneNode, "id" | "name" | "type" | "data"> & Partial<SceneNode>,
): SceneNode {
  return {
    transform: ID_TRANSFORM,
    parent_id: null,
    ...baseFields,
    ...partial,
  } as SceneNode;
}

function graph(roots: string[], nodes: SceneNode[]): SceneGraph {
  return {
    root_node_ids: roots,
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  };
}

const groupNode = (id: string, children: string[] = [], parent: string | null = null) =>
  node({
    id,
    name: id,
    type: "group",
    data: { type: "group" },
    children_ids: children,
    parent_id: parent,
  });

describe("diffSceneNodes", () => {
  it("identical graphs produce an empty diff", () => {
    const g = graph(["a"], [groupNode("a")]);
    const diff = diffSceneNodes(g, g);
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("seeding from EMPTY_SCENE_GRAPH reports every node as added, parents before children", () => {
    const child = groupNode("child", [], "parent");
    const parent = groupNode("parent", ["child"]);
    const diff = diffSceneNodes(EMPTY_SCENE_GRAPH, graph(["parent"], [parent, child]));
    expect(diff.added.map((n) => n.id)).toEqual(["parent", "child"]);
    expect(diff.updated).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("reference change == updated; untouched siblings are not reported", () => {
    const a = groupNode("a");
    const b = groupNode("b");
    const old = graph(["a", "b"], [a, b]);
    const next = graph(["a", "b"], [{ ...a, name: "renamed" }, b]);
    const diff = diffSceneNodes(old, next);
    expect(diff.updated.map((n) => n.id)).toEqual(["a"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("node present in old but missing from next == removed", () => {
    const a = groupNode("a");
    const b = groupNode("b");
    const diff = diffSceneNodes(graph(["a", "b"], [a, b]), graph(["a"], [a]));
    expect(diff.removed.map((n) => n.id)).toEqual(["b"]);
  });

  it("mixed add/update/remove in one pass", () => {
    const a = groupNode("a");
    const b = groupNode("b");
    const c = groupNode("c");
    const old = graph(["a", "b"], [a, b]);
    const next = graph(["a", "c"], [{ ...a, name: "a2" }, c]);
    const diff = diffSceneNodes(old, next);
    expect(diff.added.map((n) => n.id)).toEqual(["c"]);
    expect(diff.updated.map((n) => n.id)).toEqual(["a"]);
    expect(diff.removed.map((n) => n.id)).toEqual(["b"]);
  });
});
