import type { SceneGraph, SceneNode } from "./types";

/**
 * Capture of a subtree rooted at one node — used by DeleteNodeCommand
 * (for revert) and DuplicateNodeCommand (for apply payload).
 *
 * descendants is depth-first order (parents before children) so that
 * when restoreNodeSubtree re-inserts nodes into the graph, every
 * children_ids reference is already valid.
 */
export interface SceneNodeSnapshot {
  /** The root node of the captured subtree. */
  root: SceneNode;
  /** All descendants, depth-first (parents before children). */
  descendants: SceneNode[];
  /** Where the root sits in its parent's children_ids (or scene.root_node_ids if parent_id is null). */
  insert_index: number;
}

/**
 * Walks the scene graph starting at rootId, collecting the root + every
 * descendant in depth-first order. Throws if rootId is missing.
 */
export function snapshotSubtree(scene: SceneGraph, rootId: string): SceneNodeSnapshot {
  const root = scene.nodes[rootId];
  if (!root) throw new Error(`snapshotSubtree: unknown node id "${rootId}"`);
  const descendants: SceneNode[] = [];
  const visit = (id: string) => {
    const node = scene.nodes[id];
    if (!node) return;
    for (const childId of node.children_ids) {
      const child = scene.nodes[childId];
      if (!child) continue;
      descendants.push(child);
      visit(childId);
    }
  };
  visit(rootId);
  const siblings =
    root.parent_id === null
      ? scene.root_node_ids
      : (scene.nodes[root.parent_id]?.children_ids ?? []);
  const insert_index = siblings.indexOf(rootId);
  return { root, descendants, insert_index: insert_index < 0 ? 0 : insert_index };
}

/**
 * All node ids touched by the snapshot (root + every descendant).
 */
export function snapshotIds(snapshot: SceneNodeSnapshot): Set<string> {
  const ids = new Set<string>();
  ids.add(snapshot.root.id);
  for (const d of snapshot.descendants) ids.add(d.id);
  return ids;
}
