import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createDefaultProject } from "./defaults";
import { parseSceneProject, parseSceneProjectFromJson } from "./parse";
import { SceneProjectSchema, SPEC_VERSION } from "./schemas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(__dirname, "../../../examples");

describe("createDefaultProject", () => {
  it("produces a project that passes SceneProjectSchema", () => {
    const project = createDefaultProject({
      id: "p1",
      name: "demo",
      target: { kind: "three.js", version: "0.164.0", module_format: "esm" },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(() => SceneProjectSchema.parse(project)).not.toThrow();
    expect(project.spec_version).toBe(SPEC_VERSION);
    expect(project.scene.nodes).toEqual({});
    expect(project.scene.root_node_ids).toEqual([]);
    expect(project.metadata.created_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("uses the current time when `now` is omitted", () => {
    const before = Date.now();
    const project = createDefaultProject({
      id: "p2",
      name: "now",
      target: { kind: "three.js", version: "0.164.0", module_format: "esm" },
    });
    const ts = Date.parse(project.metadata.created_at);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
  });
});

describe("parseSceneProject", () => {
  it("returns ok for a freshly-created default project", () => {
    const project = createDefaultProject({
      id: "p3",
      name: "demo",
      target: { kind: "three.js", version: "0.164.0", module_format: "esm" },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const result = parseSceneProject(project);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.metadata.name).toBe("demo");
    }
  });

  it("reports schema_version_mismatch with both versions for an outdated project", () => {
    const result = parseSceneProject({ spec_version: "0.0.7" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("schema_version_mismatch");
      if (result.error.code === "schema_version_mismatch") {
        expect(result.error.expected_version).toBe(SPEC_VERSION);
        expect(result.error.found_version).toBe("0.0.7");
      }
    }
  });

  it("reports invalid_shape with a zodError for a wrongly-shaped project", () => {
    const result = parseSceneProject({ spec_version: SPEC_VERSION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_shape");
      if (result.error.code === "invalid_shape") {
        expect(result.error.zodError.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it("reports invalid_shape when input is not an object", () => {
    const result = parseSceneProject(42);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_shape");
    }
  });
});

describe("parseSceneProjectFromJson", () => {
  it("reports json_syntax for invalid JSON", () => {
    const result = parseSceneProjectFromJson("{ not really json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("json_syntax");
    }
  });

  it("round-trips JSON.stringify of a default project", () => {
    const project = createDefaultProject({
      id: "p4",
      name: "roundtrip",
      target: { kind: "three.js", version: "0.164.0", module_format: "esm" },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const result = parseSceneProjectFromJson(JSON.stringify(project));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project).toEqual(project);
    }
  });

  it("parses examples/empty-project/project.json", () => {
    const json = readFileSync(
      resolve(examplesDir, "empty-project/project.json"),
      "utf-8",
    );
    const result = parseSceneProjectFromJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.metadata.name).toBe("empty-project");
      expect(Object.keys(result.project.scene.nodes)).toEqual([]);
    }
  });

  it("parses examples/single-cube/project.json with three nodes", () => {
    const json = readFileSync(
      resolve(examplesDir, "single-cube/project.json"),
      "utf-8",
    );
    const result = parseSceneProjectFromJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.metadata.name).toBe("single-cube");
      expect(Object.keys(result.project.scene.nodes).sort()).toEqual([
        "cube-1",
        "key-light",
        "main-camera",
      ]);
      const cube = result.project.scene.nodes["cube-1"];
      expect(cube?.type).toBe("mesh");
      expect(result.project.assets[0]?.relative_path).toBe("assets/cube.glb");
    }
  });
});
