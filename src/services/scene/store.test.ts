import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import { snapshotSubtree } from "@/core/scene/snapshot";
import type { AssetReference, BehaviorBinding, SceneNode } from "@/core/scene/types";

import { useSceneStore } from "./store";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function freshProject() {
  return createDefaultProject({
    id: "p1",
    name: "scene-store-test",
    target: { kind: "three.js", version: "0.184.0", module_format: "esm" },
    now: new Date("2026-01-01T00:00:00Z"),
  });
}

function prefabInstance(
  id: string,
  assetId: string,
  parentId: string | null = null,
): SceneNode {
  return {
    id,
    name: id,
    type: "prefab_instance",
    transform: IDENTITY,
    parent_id: parentId,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "prefab_instance", asset_id: assetId },
    behaviors: [],
    user_data: {},
  };
}

function userAsset(id: string, hash: string): AssetReference {
  return {
    id,
    content_hash: hash,
    kind: "geometry",
    relative_path: `assets/${hash}.glb`,
    tags: [],
    description: "",
    source: { kind: "user_upload", original_filename: `${id}.glb` },
  };
}

describe("useSceneStore.addNode", () => {
  beforeEach(() => {
    useSceneStore.getState().setProject(freshProject());
  });

  it("appends a root node to root_node_ids", () => {
    useSceneStore.getState().addNode(prefabInstance("n1", "a1"));
    const project = useSceneStore.getState().project!;
    expect(project.scene.root_node_ids).toEqual(["n1"]);
    expect(project.scene.nodes["n1"]).toBeDefined();
  });

  it("appends a child node to its parent's children_ids", () => {
    useSceneStore.getState().addNode({
      ...prefabInstance("group-1", "a-irrelevant"),
      type: "group",
      data: { type: "group" },
    });
    useSceneStore.getState().addNode(prefabInstance("n1", "a1", "group-1"));
    const project = useSceneStore.getState().project!;
    expect(project.scene.root_node_ids).toEqual(["group-1"]);
    expect(project.scene.nodes["group-1"]?.children_ids).toEqual(["n1"]);
    expect(project.scene.nodes["n1"]?.parent_id).toBe("group-1");
  });

  it("throws when the id collides with an existing node", () => {
    useSceneStore.getState().addNode(prefabInstance("n1", "a1"));
    expect(() => useSceneStore.getState().addNode(prefabInstance("n1", "a2"))).toThrow(
      /already exists/,
    );
  });

  it("throws when the parent is missing", () => {
    expect(() =>
      useSceneStore.getState().addNode(prefabInstance("n1", "a1", "nope")),
    ).toThrow(/parent nope not found/);
  });
});

describe("useSceneStore.addAsset", () => {
  beforeEach(() => {
    useSceneStore.getState().setProject(freshProject());
  });

  it("appends a new asset to project.assets", () => {
    useSceneStore.getState().addAsset(userAsset("a1", "h1"));
    expect(useSceneStore.getState().project!.assets).toHaveLength(1);
  });

  it("deduplicates by content_hash and returns the existing reference", () => {
    const first = userAsset("a1", "shared-hash");
    const second = userAsset("a2", "shared-hash");
    const stored = useSceneStore.getState().addAsset(first);
    const stored2 = useSceneStore.getState().addAsset(second);
    expect(stored).toBe(first);
    expect(stored2).toBe(first); // returns the canonical first one
    expect(useSceneStore.getState().project!.assets).toHaveLength(1);
  });
});

describe("useSceneStore behavior mutators", () => {
  const sampleBinding: BehaviorBinding = {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
  };

  function seedProjectWithNode(nodeId: string) {
    useSceneStore.getState().setProject(freshProject());
    useSceneStore.getState().addNode(prefabInstance(nodeId, "asset-x"));
  }

  beforeEach(() => {
    useSceneStore.getState().setProject(null);
  });

  it("addBehavior appends a binding to the node", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([sampleBinding]);
  });

  it("addBehavior throws when binding.id is already on the node", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    expect(() => useSceneStore.getState().addBehavior("n1", sampleBinding)).toThrow(
      /duplicate/,
    );
  });

  it("removeBehavior drops the binding by id", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore.getState().removeBehavior("n1", "b1");
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([]);
  });

  it("removeBehavior on unknown bindingId is a silent no-op", () => {
    seedProjectWithNode("n1");
    expect(() => useSceneStore.getState().removeBehavior("n1", "nope")).not.toThrow();
  });

  it("setBehaviorEnabled flips the flag on the matching binding", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore.getState().setBehaviorEnabled("n1", "b1", false);
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0]!.enabled).toBe(false);
  });

  it("setBehaviorParameters replaces the params object", () => {
    seedProjectWithNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    useSceneStore
      .getState()
      .setBehaviorParameters("n1", "b1", { axis: "x", speed: 90 });
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0]!.parameters).toEqual({
      axis: "x",
      speed: 90,
    });
  });

  it("each mutator produces a new SceneNode identity (structural sharing)", () => {
    seedProjectWithNode("n1");
    const before = useSceneStore.getState().getNode("n1");
    useSceneStore.getState().addBehavior("n1", sampleBinding);
    const after = useSceneStore.getState().getNode("n1");
    expect(after).not.toBe(before);
  });
});

describe("useSceneStore subtree mutators", () => {
  beforeEach(() => useSceneStore.setState({ project: null }));

  function groupNode(
    id: string,
    parent: string | null,
    children: string[] = [],
  ): SceneNode {
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

  function seedTreeProject() {
    const project = freshProject();
    // build root → a → a1 ; root → b
    project.scene.nodes["root"] = groupNode("root", null, ["a", "b"]);
    project.scene.nodes["a"] = groupNode("a", "root", ["a1"]);
    project.scene.nodes["a1"] = groupNode("a1", "a", []);
    project.scene.nodes["b"] = groupNode("b", "root", []);
    project.scene.root_node_ids = ["root"];
    useSceneStore.setState({ project });
    return "root";
  }

  it("removeNodeSubtree removes the node + descendants + parent children_ids reference", () => {
    const root = seedTreeProject();
    useSceneStore.getState().removeNodeSubtree("a");
    const s = useSceneStore.getState();
    expect(s.getNode("a")).toBeUndefined();
    expect(s.getNode("a1")).toBeUndefined();
    expect(s.getNode("b")).toBeDefined();
    expect(s.getNode(root)!.children_ids).toEqual(["b"]);
  });

  it("removeNodeSubtree on root-level node updates scene.root_node_ids", () => {
    seedTreeProject();
    const root = useSceneStore.getState().project!.scene.root_node_ids[0]!;
    useSceneStore.getState().removeNodeSubtree(root);
    expect(useSceneStore.getState().project!.scene.root_node_ids).toEqual([]);
    expect(useSceneStore.getState().getNode(root)).toBeUndefined();
  });

  it("removeNodeSubtree on unknown id is silent no-op", () => {
    seedTreeProject();
    expect(() => useSceneStore.getState().removeNodeSubtree("nope")).not.toThrow();
  });

  it("restoreNodeSubtree puts the subtree back at insert_index with full fields", () => {
    const root = seedTreeProject();
    const snap = snapshotSubtree(useSceneStore.getState().project!.scene, "a");
    useSceneStore.getState().removeNodeSubtree("a");
    useSceneStore.getState().restoreNodeSubtree(snap);
    const after = useSceneStore.getState();
    expect(after.getNode("a")).toBeDefined();
    expect(after.getNode("a1")).toBeDefined();
    expect(after.getNode(root)!.children_ids).toEqual(["a", "b"]);
  });

  it("restoreNodeSubtree on a root-level node inserts back at the right index in root_node_ids", () => {
    const project = freshProject();
    project.scene.nodes["x"] = groupNode("x", null, []);
    project.scene.nodes["y"] = groupNode("y", null, []);
    project.scene.root_node_ids = ["x", "y"];
    useSceneStore.setState({ project });
    const snap = snapshotSubtree(useSceneStore.getState().project!.scene, "x");
    useSceneStore.getState().removeNodeSubtree("x");
    expect(useSceneStore.getState().project!.scene.root_node_ids).toEqual(["y"]);
    useSceneStore.getState().restoreNodeSubtree(snap);
    expect(useSceneStore.getState().project!.scene.root_node_ids).toEqual(["x", "y"]);
  });

  it("duplicateNode appends newSubtree.root to parent.children_ids end", () => {
    const root = seedTreeProject();
    const sourceSnap = snapshotSubtree(useSceneStore.getState().project!.scene, "a");
    // simulate caller computing a new-id snapshot
    const cloned = {
      ...sourceSnap,
      root: {
        ...sourceSnap.root,
        id: "new-a",
        name: "A Copy",
        parent_id: root,
        children_ids: ["new-a1"],
        behaviors: [],
      },
      descendants: [
        { ...sourceSnap.descendants[0]!, id: "new-a1", parent_id: "new-a" },
      ],
    };
    useSceneStore.getState().duplicateNode("a", cloned);
    const s = useSceneStore.getState();
    expect(s.getNode("new-a")).toBeDefined();
    expect(s.getNode("new-a1")).toBeDefined();
    expect(s.getNode(root)!.children_ids).toEqual(["a", "b", "new-a"]);
    // original still there
    expect(s.getNode("a")).toBeDefined();
  });

  it("duplicateNode on root-level node appends to scene.root_node_ids", () => {
    const project = freshProject();
    project.scene.nodes["x"] = groupNode("x", null, []);
    project.scene.root_node_ids = ["x"];
    useSceneStore.setState({ project });
    const sourceSnap = snapshotSubtree(useSceneStore.getState().project!.scene, "x");
    const cloned = {
      ...sourceSnap,
      root: { ...sourceSnap.root, id: "x2", name: "X Copy" },
      descendants: [],
    };
    useSceneStore.getState().duplicateNode("x", cloned);
    expect(useSceneStore.getState().project!.scene.root_node_ids).toEqual(["x", "x2"]);
  });
});
