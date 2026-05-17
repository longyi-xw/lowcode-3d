import { SPEC_VERSION } from "./schemas";
import type { RuntimeTarget, SceneProject } from "./types";

export interface CreateDefaultProjectInput {
  id: string;
  name: string;
  target: RuntimeTarget;
  /** Defaults to `new Date()` at call time. */
  now?: Date;
}

/**
 * Factory for a fresh, empty SceneProject that satisfies SceneProjectSchema.
 * Used by both New project and the test fixtures.
 */
export function createDefaultProject(input: CreateDefaultProjectInput): SceneProject {
  const ts = (input.now ?? new Date()).toISOString();
  return {
    spec_version: SPEC_VERSION,
    metadata: {
      id: input.id,
      name: input.name,
      created_at: ts,
      updated_at: ts,
      target_runtime: input.target,
    },
    scene: {
      nodes: {},
      root_node_ids: [],
    },
    assets: [],
    settings: {
      units: "meters",
      up_axis: "y",
      background: { kind: "color", color: "#0a0a0a" },
    },
  };
}
