import type { SceneNode } from "./types";

/**
 * Whether the editor should treat a node as locked for transform editing.
 *
 * The `node.locked` field on disk is the user-authored intent — they can
 * later flip it on any node via a future inspector toggle. On top of that
 * we layer a type-driven default: helpers (grid, axes, future guides) are
 * editor chrome, not user content, and are ALWAYS locked regardless of
 * what's stored. That keeps "grid is unmovable" stable across projects
 * created before the convention existed and across hand-edited project
 * files where the field might disagree.
 *
 * If a future helper subtype genuinely wants to be movable, that's a
 * `helper_kind`-keyed exception added here — don't reach for `node.locked`
 * directly outside of this module.
 */
export function isEffectivelyLocked(node: SceneNode): boolean {
  if (node.type === "helper") return true;
  return node.locked;
}
