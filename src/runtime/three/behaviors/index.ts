import { AutoRotateBehavior } from "./auto-rotate";
import { ThreeBehaviorRegistry } from "./registry";

export { ThreeBehaviorRegistry } from "./registry";
export type { Behavior, BehaviorHandle } from "./types";

/**
 * Build a registry pre-populated with the v1 behavior catalog. Each
 * ThreeAdapter instance gets its own registry — behavior implementations are
 * stateless and shareable, but the registry itself is held as a per-adapter
 * field so future per-project custom behaviors can be appended without
 * leaking across adapters.
 */
export function createThreeBehaviorRegistry(): ThreeBehaviorRegistry {
  const r = new ThreeBehaviorRegistry();
  r.register(new AutoRotateBehavior());
  return r;
}
