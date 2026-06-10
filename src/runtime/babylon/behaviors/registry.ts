import type { BabylonBehavior } from "./types";

/** Per-adapter registry of Babylon behavior implementations, keyed by
 *  BehaviorDefinition.type. Mirrors ThreeBehaviorRegistry. */
export class BabylonBehaviorRegistry {
  private readonly behaviors = new Map<string, BabylonBehavior>();

  register(b: BabylonBehavior): void {
    const type = b.definition.type;
    if (this.behaviors.has(type)) {
      throw new Error(`BabylonBehaviorRegistry: duplicate type "${type}"`);
    }
    this.behaviors.set(type, b);
  }

  get(type: string): BabylonBehavior | undefined {
    return this.behaviors.get(type);
  }

  list(): BabylonBehavior[] {
    return [...this.behaviors.values()];
  }
}
