import { describe, expect, it } from "vitest";

import type { SceneGraph, SceneNode } from "./types";

import {
  cloneSubtreeWithNewIds,
  generateCopyName,
  snapshotIds,
  snapshotSubtree,
} from "./snapshot";

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

describe("generateCopyName", () => {
  it("appends ' Copy' when no copies exist", () => {
    expect(generateCopyName("Cube", ["Cube", "Light"])).toBe("Cube Copy");
  });

  it("uses ' Copy 2' when ' Copy' already exists", () => {
    expect(generateCopyName("Cube", ["Cube", "Cube Copy"])).toBe("Cube Copy 2");
  });

  it("continues counting past existing Copy 2", () => {
    expect(generateCopyName("Cube", ["Cube Copy", "Cube Copy 2"])).toBe("Cube Copy 3");
  });

  it("when input itself has ' Copy' suffix, strips it before recounting", () => {
    expect(generateCopyName("Cube Copy", ["Cube Copy"])).toBe("Cube Copy 2");
    expect(generateCopyName("Cube Copy 2", ["Cube Copy 2"])).toBe("Cube Copy 3");
  });

  it("does not strip 'Copyright' or other words containing Copy", () => {
    expect(generateCopyName("Copyright", ["Copyright"])).toBe("Copyright Copy");
  });
});

describe("cloneSubtreeWithNewIds", () => {
  it("regenerates root id + descendant ids + behavior binding ids", () => {
    const scene: SceneGraph = {
      root_node_ids: ["a"],
      nodes: {
        a: {
          id: "a",
          name: "A",
          type: "group",
          transform: IDENTITY,
          parent_id: null,
          children_ids: ["a1"],
          visible: true,
          locked: false,
          data: { type: "group" },
          behaviors: [
            { id: "b1", behavior_type: "auto-rotate", enabled: true, parameters: {} },
          ],
          user_data: {},
        },
        a1: {
          id: "a1",
          name: "A1",
          type: "group",
          transform: IDENTITY,
          parent_id: "a",
          children_ids: [],
          visible: true,
          locked: false,
          data: { type: "group" },
          behaviors: [],
          user_data: {},
        },
      },
    };
    const snap = snapshotSubtree(scene, "a");
    const newId = (): string => Math.random().toString(36).slice(2);
    const cloned = cloneSubtreeWithNewIds(snap, null, "A Copy", newId);
    expect(cloned.root.id).not.toBe("a");
    expect(cloned.root.name).toBe("A Copy");
    expect(cloned.root.parent_id).toBe(null);
    expect(cloned.descendants[0]!.id).not.toBe("a1");
    expect(cloned.descendants[0]!.parent_id).toBe(cloned.root.id);
    // every old id has been replaced; behavior binding id too
    expect(cloned.root.behaviors[0]!.id).not.toBe("b1");
    // children_ids of root point at the new descendant id
    expect(cloned.root.children_ids).toEqual([cloned.descendants[0]!.id]);
  });

  it("preserves transform / data / behaviors content (only ids change)", () => {
    const transform = {
      position: [1, 2, 3] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      scale: [4, 4, 4] as [number, number, number],
    };
    const scene: SceneGraph = {
      root_node_ids: ["a"],
      nodes: {
        a: {
          id: "a",
          name: "A",
          type: "group",
          transform,
          parent_id: null,
          children_ids: [],
          visible: true,
          locked: false,
          data: { type: "group" },
          behaviors: [
            {
              id: "b1",
              behavior_type: "auto-rotate",
              enabled: true,
              parameters: { axis: "y", speed: 30 },
            },
          ],
          user_data: { tag: "marker" },
        },
      },
    };
    const snap = snapshotSubtree(scene, "a");
    let counter = 0;
    const newId = (): string => `new-${++counter}`;
    const cloned = cloneSubtreeWithNewIds(snap, "newParent", "A Copy", newId);
    expect(cloned.root.transform).toEqual(transform);
    expect(cloned.root.parent_id).toBe("newParent");
    expect(cloned.root.user_data).toEqual({ tag: "marker" });
    expect(cloned.root.behaviors[0]!.parameters).toEqual({ axis: "y", speed: 30 });
  });
});
