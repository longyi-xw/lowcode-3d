import { Box, LayoutTemplate, Square } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { generateUUID } from "@/core/id/uuid";
import { createDefaultProject } from "@/core/scene/defaults";
import type { SceneNode, SceneProject } from "@/core/scene/types";

import { TARGET, createDemoProject } from "./demo-project";

export type TemplateId = "starter" | "single-cube" | "empty";

export interface ProjectTemplate {
  id: TemplateId;
  /** i18n key under the "project" namespace. */
  nameKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  recommended?: boolean;
  /** Always returns a fresh project (new metadata.id + timestamps). */
  create: (name?: string) => SceneProject;
}

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

/** Blank scene — thin wrapper over createDefaultProject with a fresh id. */
export function createEmptyProject(name = "Untitled project"): SceneProject {
  return createDefaultProject({ id: generateUUID(), name, target: TARGET });
}

/**
 * One cube (builtin primitive) + one directional light + one perspective
 * camera. Mirrors examples/single-cube/project.json structurally; the
 * drift-guard test keeps them in sync. Fresh id/timestamps + current TARGET.
 */
export function createSingleCubeProject(name = "Untitled project"): SceneProject {
  const base = createDefaultProject({ id: generateUUID(), name, target: TARGET });
  const nodes: Record<string, SceneNode> = {
    "cube-1": {
      id: "cube-1",
      name: "Cube",
      type: "mesh",
      transform: IDENTITY,
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "mesh", asset_id: "asset-cube" },
      behaviors: [],
      user_data: {},
    },
    "key-light": {
      id: "key-light",
      name: "Key Light",
      type: "light",
      transform: { ...IDENTITY, position: [3, 5, 3] },
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "light",
        light_kind: "directional",
        color: "#ffffff",
        intensity: 1.2,
        cast_shadow: true,
      },
      behaviors: [],
      user_data: {},
    },
    "main-camera": {
      id: "main-camera",
      name: "Main Camera",
      type: "camera",
      transform: { ...IDENTITY, position: [4, 3, 4] },
      parent_id: null,
      children_ids: [],
      visible: true,
      locked: false,
      data: {
        type: "camera",
        camera_kind: "perspective",
        fov: 50,
        near: 0.1,
        far: 1000,
      },
      behaviors: [],
      user_data: {},
    },
  };
  return {
    ...base,
    scene: { nodes, root_node_ids: ["cube-1", "key-light", "main-camera"] },
    assets: [
      {
        id: "asset-cube",
        content_hash: "sha256-cube-placeholder",
        kind: "geometry",
        relative_path: "assets/cube.glb",
        tags: ["primitive", "cube"],
        description: "1m unit cube used as scaffolding primitive",
        source: { kind: "builtin", library_id: "primitives" },
      },
    ],
    settings: { ...base.settings, background: { kind: "color", color: "#101418" } },
  };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "starter",
    nameKey: "templates.starter.name",
    descriptionKey: "templates.starter.description",
    icon: LayoutTemplate,
    recommended: true,
    create: createDemoProject,
  },
  {
    id: "single-cube",
    nameKey: "templates.single_cube.name",
    descriptionKey: "templates.single_cube.description",
    icon: Box,
    create: createSingleCubeProject,
  },
  {
    id: "empty",
    nameKey: "templates.empty.name",
    descriptionKey: "templates.empty.description",
    icon: Square,
    create: createEmptyProject,
  },
];
