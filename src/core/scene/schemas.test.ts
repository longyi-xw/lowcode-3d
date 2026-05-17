import { describe, expect, it } from "vitest";
import {
  AssetReferenceSchema,
  NodeDataSchema,
  RuntimeTargetSchema,
  SceneNodeSchema,
  SceneProjectSchema,
  SPEC_VERSION,
  TransformSchema,
} from "./schemas";

const identityTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
} as const;

describe("TransformSchema", () => {
  it("accepts an identity transform", () => {
    expect(TransformSchema.parse(identityTransform)).toEqual(identityTransform);
  });

  it("rejects a position with the wrong number of components", () => {
    expect(() =>
      TransformSchema.parse({
        position: [0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      }),
    ).toThrow();
  });

  it("rejects a quaternion with three components", () => {
    expect(() =>
      TransformSchema.parse({
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }),
    ).toThrow();
  });
});

describe("RuntimeTargetSchema", () => {
  it("accepts a three.js target with module_format", () => {
    expect(
      RuntimeTargetSchema.parse({
        kind: "three.js",
        version: "0.164.0",
        module_format: "esm",
      }),
    ).toMatchObject({ kind: "three.js", module_format: "esm" });
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      RuntimeTargetSchema.parse({ kind: "playcanvas", version: "1.0.0" }),
    ).toThrow();
  });

  it("rejects unity without render_pipeline", () => {
    expect(() =>
      RuntimeTargetSchema.parse({ kind: "unity", version: "2023.1" }),
    ).toThrow();
  });
});

describe("NodeDataSchema", () => {
  it("accepts mesh data with asset_id", () => {
    expect(NodeDataSchema.parse({ type: "mesh", asset_id: "abc" })).toMatchObject({
      type: "mesh",
      asset_id: "abc",
    });
  });

  it("rejects light data without intensity", () => {
    expect(() =>
      NodeDataSchema.parse({
        type: "light",
        light_kind: "point",
        color: "#ffffff",
      }),
    ).toThrow();
  });

  it("rejects mesh-style light_kind on mesh data", () => {
    expect(() =>
      NodeDataSchema.parse({
        type: "mesh",
        asset_id: "abc",
        light_kind: "point",
      }),
    ).not.toThrow(); // unknown extra keys are allowed by default
  });
});

describe("SceneNodeSchema", () => {
  const baseNode = {
    id: "n1",
    name: "n1",
    transform: identityTransform,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    behaviors: [],
    user_data: {},
  };

  it("accepts a consistent group node", () => {
    expect(
      SceneNodeSchema.parse({
        ...baseNode,
        type: "group",
        data: { type: "group" },
      }),
    ).toMatchObject({ id: "n1", type: "group" });
  });

  it("rejects when node.type and node.data.type disagree", () => {
    expect(() =>
      SceneNodeSchema.parse({
        ...baseNode,
        type: "group",
        data: { type: "mesh", asset_id: "a" },
      }),
    ).toThrow(/node\.type must equal node\.data\.type/);
  });
});

describe("AssetReferenceSchema", () => {
  it("accepts a user-uploaded geometry asset", () => {
    expect(
      AssetReferenceSchema.parse({
        id: "a1",
        content_hash: "sha256-deadbeef",
        kind: "geometry",
        relative_path: "assets/deadbeef.glb",
        tags: ["chair"],
        description: "office chair",
        source: { kind: "user_upload", original_filename: "chair.glb" },
      }),
    ).toMatchObject({ kind: "geometry" });
  });
});

describe("SceneProjectSchema", () => {
  const minimal = {
    spec_version: SPEC_VERSION,
    metadata: {
      id: "p1",
      name: "demo",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      target_runtime: {
        kind: "three.js",
        version: "0.164.0",
        module_format: "esm",
      },
    },
    scene: { nodes: {}, root_node_ids: [] },
    assets: [],
    settings: {
      units: "meters",
      up_axis: "y",
      background: { kind: "color", color: "#0a0a0a" },
    },
  };

  it("accepts a minimal valid project", () => {
    expect(SceneProjectSchema.parse(minimal)).toMatchObject({
      spec_version: SPEC_VERSION,
    });
  });

  it("rejects a project with an outdated spec_version", () => {
    expect(() =>
      SceneProjectSchema.parse({ ...minimal, spec_version: "0.0.7" }),
    ).toThrow();
  });
});
