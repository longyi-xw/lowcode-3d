import type { BehaviorBinding, SceneGraph, SceneNode } from "./types";

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

/**
 * Given an existing node name and the set of sibling names already
 * present, return a fresh "{base} Copy" / "{base} Copy 2" / ...
 * style name that doesn't collide.
 *
 * Strips a trailing " Copy" / " Copy N" off the input first, so
 * duplicating a node already named "Cube Copy" yields "Cube Copy 2",
 * not "Cube Copy Copy".
 *
 * The regex anchors on a leading space (" Copy") so words like
 * "Copyright" are not mistakenly stripped.
 */
export function generateCopyName(originalName: string, siblingNames: string[]): string {
  const COPY_SUFFIX = / Copy( \d+)?$/;
  const matched = COPY_SUFFIX.test(originalName);
  const base = originalName.replace(COPY_SUFFIX, "");
  const siblings = new Set(siblingNames);
  const first = `${base} Copy`;
  // When originalName itself already matches the copy pattern, the unsuffixed
  // "{base} Copy" is conceptually already occupied (it's slot #1 of the
  // sequence whose suffixed entry produced originalName), so we must skip it.
  if (!siblings.has(first) && !matched) return first;
  let n = 2;
  while (siblings.has(`${base} Copy ${n}`)) n++;
  return `${base} Copy ${n}`;
}

/**
 * Produce a fresh SceneNodeSnapshot where the root + every descendant
 * + every BehaviorBinding has a newly generated id. parent_id of the
 * root is set to newParentId (or null); name of the root is replaced
 * with copyName (descendants keep their original names).
 *
 * Caller supplies idFactory so tests can use deterministic ids and
 * production code can use generateUUID.
 */
export function cloneSubtreeWithNewIds(
  source: SceneNodeSnapshot,
  newParentId: string | null,
  copyName: string,
  idFactory: () => string,
): SceneNodeSnapshot {
  // map from old id to new id (root + descendants)
  const idMap = new Map<string, string>();
  idMap.set(source.root.id, idFactory());
  for (const d of source.descendants) idMap.set(d.id, idFactory());

  const rebuildNode = (n: SceneNode, isRoot: boolean): SceneNode => {
    const newId = idMap.get(n.id)!;
    const newChildrenIds = n.children_ids.map((cid) => idMap.get(cid) ?? cid);
    const newParent = isRoot
      ? newParentId
      : (idMap.get(n.parent_id ?? "") ?? n.parent_id);
    const newBehaviors: BehaviorBinding[] = n.behaviors.map((b) => ({
      ...b,
      id: idFactory(),
    }));
    return {
      ...n,
      id: newId,
      name: isRoot ? copyName : n.name,
      parent_id: newParent,
      children_ids: newChildrenIds,
      behaviors: newBehaviors,
    };
  };

  const newRoot = rebuildNode(source.root, true);
  const newDescendants = source.descendants.map((d) => rebuildNode(d, false));

  return {
    root: newRoot,
    descendants: newDescendants,
    insert_index: source.insert_index, // duplicate inserts at end; index unused
  };
}
