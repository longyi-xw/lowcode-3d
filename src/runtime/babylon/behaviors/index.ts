import { AutoRotateBehavior } from "./auto-rotate";
import { BobBehavior } from "./bob";
import { BabylonBehaviorRegistry } from "./registry";

export { BabylonBehaviorRegistry } from "./registry";
export type { BabylonBehavior, BabylonBehaviorHandle } from "./types";

/** Build a registry pre-populated with the A2 behavior catalog (auto-rotate +
 *  bob). Per-adapter instance, mirroring createThreeBehaviorRegistry. */
export function createBabylonBehaviorRegistry(): BabylonBehaviorRegistry {
  const r = new BabylonBehaviorRegistry();
  r.register(new AutoRotateBehavior());
  r.register(new BobBehavior());
  return r;
}
