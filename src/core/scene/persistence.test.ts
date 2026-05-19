import { describe, expect, it } from "vitest";

import { createDemoProject } from "@/services/scene/demo-project";

import {
  HIERARCHY_FILE,
  NODE_DIR,
  PROJECT_FILE,
  SerializeError,
  deserializeProject,
  serializeProject,
} from "./persistence";
import type { SceneNode, SceneProject } from "./types";

function fixedDemo(): SceneProject {
  const project = createDemoProject("Round trip");
  // Pin the generated UUID + timestamps so snapshot-style assertions are stable.
  return {
    ...project,
    metadata: {
      ...project.metadata,
      id: "project-1",
      created_at: "2026-05-19T00:00:00.000Z",
      updated_at: "2026-05-19T00:00:00.000Z",
    },
  };
}

describe("serializeProject", () => {
  it("emits project.json, scene/hierarchy.json, and one file per node", () => {
    const project = fixedDemo();
    const files = serializeProject(project);

    expect(files.has(PROJECT_FILE)).toBe(true);
    expect(files.has(HIERARCHY_FILE)).toBe(true);
    for (const id of Object.keys(project.scene.nodes)) {
      expect(files.has(`${NODE_DIR}/${id}.json`)).toBe(true);
    }
    // total = top-level + hierarchy + one per node
    expect(files.size).toBe(2 + Object.keys(project.scene.nodes).length);
  });

  it("keeps scene out of project.json (it lives in hierarchy + node files)", () => {
    const files = serializeProject(fixedDemo());
    const meta = JSON.parse(files.get(PROJECT_FILE) ?? "{}") as Record<string, unknown>;
    expect(meta).not.toHaveProperty("scene");
    expect(meta).toHaveProperty("spec_version");
    expect(meta).toHaveProperty("metadata");
    expect(meta).toHaveProperty("assets");
    expect(meta).toHaveProperty("settings");
  });

  it("strips parent_id and children_ids from per-node files", () => {
    const project = fixedDemo();
    const files = serializeProject(project);
    const cubeJson = files.get(`${NODE_DIR}/cube-1.json`);
    expect(cubeJson).toBeDefined();
    const cube = JSON.parse(cubeJson ?? "{}") as Record<string, unknown>;
    expect(cube).not.toHaveProperty("parent_id");
    expect(cube).not.toHaveProperty("children_ids");
    expect(cube.id).toBe("cube-1");
    expect(cube.type).toBe("mesh");
  });

  it("captures parent→children adjacency in hierarchy.json", () => {
    const files = serializeProject(fixedDemo());
    const hier = JSON.parse(files.get(HIERARCHY_FILE) ?? "{}") as {
      root_node_ids: string[];
      children: Record<string, string[]>;
    };
    expect(hier.root_node_ids).toEqual([
      "grid-helper",
      "models-group",
      "key-light",
      "fill-light",
    ]);
    expect(hier.children["models-group"]).toEqual(["cube-1"]);
    // childless nodes shouldn't show up in children to keep diffs small
    expect(hier.children["cube-1"]).toBeUndefined();
    expect(hier.children["grid-helper"]).toBeUndefined();
  });

  it("rejects node ids that aren't safe filenames", () => {
    const project = fixedDemo();
    const badId = "foo/bar";
    const badNode: SceneNode = {
      ...(project.scene.nodes["cube-1"] as SceneNode),
      id: badId,
      parent_id: null,
      children_ids: [],
    };
    const bad: SceneProject = {
      ...project,
      scene: {
        root_node_ids: [badId],
        nodes: { [badId]: badNode },
      },
    };
    expect(() => serializeProject(bad)).toThrow(SerializeError);
  });
});

describe("deserializeProject", () => {
  it("round-trips the demo project (deep equality)", () => {
    const project = fixedDemo();
    const files = serializeProject(project);
    const result = deserializeProject(files);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project).toEqual(project);
    }
  });

  it("reconstructs parent_id and children_ids from hierarchy", () => {
    const project = fixedDemo();
    const files = serializeProject(project);
    const result = deserializeProject(files);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.scene.nodes["cube-1"]?.parent_id).toBe("models-group");
      expect(result.project.scene.nodes["cube-1"]?.children_ids).toEqual([]);
      expect(result.project.scene.nodes["models-group"]?.parent_id).toBeNull();
      expect(result.project.scene.nodes["models-group"]?.children_ids).toEqual([
        "cube-1",
      ]);
    }
  });

  it("reports missing_file when project.json is absent", () => {
    const files = serializeProject(fixedDemo());
    files.delete(PROJECT_FILE);
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("missing_file");
      if (result.error.code === "missing_file") {
        expect(result.error.path).toBe(PROJECT_FILE);
      }
    }
  });

  it("reports missing_file when hierarchy.json is absent", () => {
    const files = serializeProject(fixedDemo());
    files.delete(HIERARCHY_FILE);
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("missing_file");
    }
  });

  it("reports json_syntax for malformed JSON and points at the file", () => {
    const files = serializeProject(fixedDemo());
    files.set(`${NODE_DIR}/cube-1.json`, "{ not really json");
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("json_syntax");
      if (result.error.code === "json_syntax") {
        expect(result.error.path).toBe(`${NODE_DIR}/cube-1.json`);
      }
    }
  });

  it("reports schema when a node body's id doesn't match its filename", () => {
    const files = serializeProject(fixedDemo());
    const cube = JSON.parse(files.get(`${NODE_DIR}/cube-1.json`) ?? "{}") as Record<
      string,
      unknown
    >;
    cube.id = "renamed";
    files.set(`${NODE_DIR}/cube-1.json`, JSON.stringify(cube));
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("schema");
    }
  });

  it("reports hierarchy when a referenced node file is missing", () => {
    const files = serializeProject(fixedDemo());
    files.delete(`${NODE_DIR}/cube-1.json`);
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("hierarchy");
    }
  });

  it("ignores extra files outside the recognised paths", () => {
    const files = serializeProject(fixedDemo());
    files.set(".lowcode/cache/thumbnail.png", "binary blob");
    files.set("README.md", "user notes");
    const result = deserializeProject(files);
    expect(result.ok).toBe(true);
  });

  it("reports hierarchy when a node is listed under two parents", () => {
    const project = fixedDemo();
    const files = serializeProject(project);
    const hier = JSON.parse(files.get(HIERARCHY_FILE) ?? "{}") as {
      root_node_ids: string[];
      children: Record<string, string[]>;
    };
    hier.children["key-light"] = ["cube-1"];
    files.set(HIERARCHY_FILE, JSON.stringify(hier));
    const result = deserializeProject(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("hierarchy");
    }
  });
});
