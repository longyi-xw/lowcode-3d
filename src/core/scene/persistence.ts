import { ZodError } from "zod";

import { SceneProjectSchema } from "./schemas";
import type { SceneNode, SceneProject } from "./types";

/**
 * Architecture §3.5 folder layout for a saved project:
 *
 *   my-project/
 *   ├── project.json          ← top-level (no scene)
 *   ├── scene/
 *   │   ├── hierarchy.json    ← root_node_ids + parent→children adjacency
 *   │   └── nodes/
 *   │       └── {node_id}.json  ← node body, no parent_id / children_ids
 *
 * Per-node files intentionally omit `parent_id` and `children_ids`: moving a
 * node updates only `hierarchy.json` instead of dirtying the moved node + both
 * parents, which keeps git diffs minimal during collaborative edits.
 *
 * This module is pure — it converts between `SceneProject` and a `Map<path,
 * content>` of relative paths to JSON strings. The actual disk I/O sits in the
 * Tauri layer.
 */

export const PROJECT_FILE = "project.json";
export const HIERARCHY_FILE = "scene/hierarchy.json";
export const NODE_DIR = "scene/nodes";

const NODE_PATH_RE = /^scene\/nodes\/(.+)\.json$/;
const FS_UNSAFE_ID_RE = /[\\/:*?"<>|\s]/;

type NodeBodyOnDisk = Omit<SceneNode, "parent_id" | "children_ids">;

type HierarchyOnDisk = {
  root_node_ids: string[];
  children: Record<string, string[]>;
};

type ProjectMetaOnDisk = Omit<SceneProject, "scene">;

export type SerializedFiles = Map<string, string>;

export type DeserializeResult =
  | { ok: true; project: SceneProject }
  | { ok: false; error: PersistenceError };

export type PersistenceError =
  | { code: "missing_file"; path: string; message: string }
  | { code: "json_syntax"; path: string; message: string }
  | { code: "hierarchy"; message: string }
  | { code: "schema"; path: string; message: string; zodError?: ZodError };

export class SerializeError extends Error {
  constructor(
    message: string,
    readonly nodeId?: string,
  ) {
    super(message);
    this.name = "SerializeError";
  }
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeProject(project: SceneProject): SerializedFiles {
  const files: SerializedFiles = new Map();

  const meta: ProjectMetaOnDisk = {
    spec_version: project.spec_version,
    metadata: project.metadata,
    assets: project.assets,
    settings: project.settings,
  };
  files.set(PROJECT_FILE, pretty(meta));

  const children: Record<string, string[]> = {};
  for (const [id, node] of Object.entries(project.scene.nodes)) {
    if (node.children_ids.length > 0) {
      children[id] = [...node.children_ids];
    }
  }
  const hierarchy: HierarchyOnDisk = {
    root_node_ids: [...project.scene.root_node_ids],
    children,
  };
  files.set(HIERARCHY_FILE, pretty(hierarchy));

  for (const [id, node] of Object.entries(project.scene.nodes)) {
    if (FS_UNSAFE_ID_RE.test(id)) {
      throw new SerializeError(
        `node id "${id}" contains characters that aren't safe as a filename`,
        id,
      );
    }
    const body: NodeBodyOnDisk = {
      id: node.id,
      name: node.name,
      type: node.type,
      transform: node.transform,
      visible: node.visible,
      locked: node.locked,
      data: node.data,
      behaviors: node.behaviors,
      sockets: node.sockets,
      user_data: node.user_data,
    };
    files.set(`${NODE_DIR}/${id}.json`, pretty(body));
  }

  return files;
}

export function deserializeProject(
  files: ReadonlyMap<string, string>,
): DeserializeResult {
  const metaJson = files.get(PROJECT_FILE);
  if (metaJson === undefined) {
    return {
      ok: false,
      error: {
        code: "missing_file",
        path: PROJECT_FILE,
        message: `missing required file ${PROJECT_FILE}`,
      },
    };
  }
  const metaParsed = tryParseJson(metaJson, PROJECT_FILE);
  if (!metaParsed.ok) return { ok: false, error: metaParsed.error };

  const hierarchyJson = files.get(HIERARCHY_FILE);
  if (hierarchyJson === undefined) {
    return {
      ok: false,
      error: {
        code: "missing_file",
        path: HIERARCHY_FILE,
        message: `missing required file ${HIERARCHY_FILE}`,
      },
    };
  }
  const hierarchyParsed = tryParseJson(hierarchyJson, HIERARCHY_FILE);
  if (!hierarchyParsed.ok) return { ok: false, error: hierarchyParsed.error };
  const hierarchyRaw = hierarchyParsed.value as Partial<HierarchyOnDisk>;
  if (
    !Array.isArray(hierarchyRaw.root_node_ids) ||
    typeof hierarchyRaw.children !== "object" ||
    hierarchyRaw.children === null
  ) {
    return {
      ok: false,
      error: {
        code: "hierarchy",
        message: `${HIERARCHY_FILE} must contain { root_node_ids: string[], children: Record<string, string[]> }`,
      },
    };
  }
  const hierarchy = hierarchyRaw as HierarchyOnDisk;

  const parentOf: Record<string, string | null> = {};
  for (const id of hierarchy.root_node_ids) parentOf[id] = null;
  for (const [parentId, childIds] of Object.entries(hierarchy.children)) {
    if (!Array.isArray(childIds)) {
      return {
        ok: false,
        error: {
          code: "hierarchy",
          message: `${HIERARCHY_FILE} children entry for "${parentId}" must be an array`,
        },
      };
    }
    for (const childId of childIds) {
      if (parentOf[childId] !== undefined && parentOf[childId] !== parentId) {
        return {
          ok: false,
          error: {
            code: "hierarchy",
            message: `node "${childId}" is listed under multiple parents`,
          },
        };
      }
      parentOf[childId] = parentId;
    }
  }

  const nodes: Record<string, SceneNode> = {};
  for (const [path, content] of files) {
    const match = NODE_PATH_RE.exec(path);
    if (!match) continue;
    const idFromPath = match[1];
    if (idFromPath === undefined) continue;
    const parsed = tryParseJson(content, path);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const body = parsed.value as Partial<NodeBodyOnDisk>;
    if (body.id !== idFromPath) {
      return {
        ok: false,
        error: {
          code: "schema",
          path,
          message: `node body id "${body.id ?? "(missing)"}" does not match filename "${idFromPath}"`,
        },
      };
    }
    const parent_id = parentOf[idFromPath] ?? null;
    const children_ids = hierarchy.children[idFromPath] ?? [];
    nodes[idFromPath] = {
      ...(body as NodeBodyOnDisk),
      parent_id,
      children_ids,
    };
  }

  for (const id of Object.keys(parentOf)) {
    if (!(id in nodes)) {
      return {
        ok: false,
        error: {
          code: "hierarchy",
          message: `hierarchy references missing node file: scene/nodes/${id}.json`,
        },
      };
    }
  }

  const combined = {
    ...(metaParsed.value as Record<string, unknown>),
    scene: {
      nodes,
      root_node_ids: hierarchy.root_node_ids,
    },
  };
  const result = SceneProjectSchema.safeParse(combined);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "schema",
        path: "(combined)",
        message: "combined project failed schema validation",
        zodError: result.error,
      },
    };
  }
  return { ok: true, project: result.data };
}

type JsonResult = { ok: true; value: unknown } | { ok: false; error: PersistenceError };

function tryParseJson(content: string, path: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "json_syntax",
        path,
        message: e instanceof Error ? e.message : "invalid JSON",
      },
    };
  }
}
