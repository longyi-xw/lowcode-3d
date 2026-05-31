import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SceneProjectSchema } from "@/core/scene/schemas";

import { PROJECT_TEMPLATES, createSingleCubeProject } from "./templates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(__dirname, "../../../examples");

describe("PROJECT_TEMPLATES", () => {
  it("lists starter, single-cube, empty in order", () => {
    expect(PROJECT_TEMPLATES.map((t) => t.id)).toEqual([
      "starter",
      "single-cube",
      "empty",
    ]);
  });

  it("marks only starter as recommended", () => {
    expect(PROJECT_TEMPLATES.filter((t) => t.recommended).map((t) => t.id)).toEqual([
      "starter",
    ]);
  });

  it("every create() passes SceneProjectSchema", () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(() => SceneProjectSchema.parse(t.create())).not.toThrow();
    }
  });

  it("create() yields a fresh project id each call", () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(t.create().metadata.id).not.toBe(t.create().metadata.id);
    }
  });

  it("each template has templates.* i18n keys + an icon", () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(t.nameKey).toMatch(/^templates\./);
      expect(t.descriptionKey).toMatch(/^templates\./);
      expect(t.icon).toBeTruthy();
    }
  });
});

describe("createSingleCubeProject", () => {
  it("matches examples/single-cube/project.json (ignoring volatile metadata)", () => {
    const raw = JSON.parse(
      readFileSync(resolve(examplesDir, "single-cube/project.json"), "utf-8"),
    );
    const normalize = (p: {
      metadata: Record<string, unknown> & { target_runtime: Record<string, unknown> };
    }) => ({
      ...p,
      metadata: {
        ...p.metadata,
        id: "X",
        name: "X",
        created_at: "X",
        updated_at: "X",
        target_runtime: { ...p.metadata.target_runtime, version: "X" },
      },
    });
    expect(normalize(createSingleCubeProject())).toEqual(normalize(raw));
  });
});
