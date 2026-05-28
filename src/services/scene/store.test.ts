import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
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
