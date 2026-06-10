import type { SceneGraph, SceneNode } from "@/core/scene/types";

/**
 * Engine-neutral scene diff (v1.0 B1). Mirrors the node-identity semantics of
 * ThreeViewport's diffAndApply walk — BFS over `next` roots so parents always
 * precede their children in `added`, reference inequality == updated — but
 * only computes the diff; callers apply it via their adapter's syncNode.
 * ThreeViewport keeps its own inline walk until B2 converges it onto this.
 */
export interface SceneDiff {
  /** BFS order from the roots — parents precede children, so applying adds
   *  in order never references an unregistered parent. */
  added: SceneNode[];
  updated: SceneNode[];
  removed: SceneNode[];
}

/** Seed a fresh viewport via diffSceneNodes(EMPTY_SCENE_GRAPH, project.scene). */
export const EMPTY_SCENE_GRAPH: SceneGraph = { nodes: {}, root_node_ids: [] };

export function diffSceneNodes(old: SceneGraph, next: SceneGraph): SceneDiff {
  const added: SceneNode[] = [];
  const updated: SceneNode[] = [];
  const removed: SceneNode[] = [];
  const queue: string[] = [...next.root_node_ids];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const n = next.nodes[id];
    if (!n) continue;
    const o = old.nodes[id];
    if (!o) added.push(n);
    else if (n !== o) updated.push(n);
    queue.push(...n.children_ids);
  }
  for (const id of Object.keys(old.nodes)) {
    if (!next.nodes[id]) {
      const r = old.nodes[id];
      if (r) removed.push(r);
    }
  }
  return { added, updated, removed };
}
