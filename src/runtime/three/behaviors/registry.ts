import type { Behavior } from "./types";

/**
 * Per-adapter registry of Behavior implementations, keyed by
 * BehaviorDefinition.type. Owned by ThreeAdapter (same lifetime as the
 * AssetCache / BuilderRegistry).
 */
export class ThreeBehaviorRegistry {
  private readonly behaviors = new Map<string, Behavior>();

  register(b: Behavior): void {
    const type = b.definition.type;
    if (this.behaviors.has(type)) {
      throw new Error(`ThreeBehaviorRegistry: duplicate type "${type}"`);
    }
    this.behaviors.set(type, b);
  }

  get(type: string): Behavior | undefined {
    return this.behaviors.get(type);
  }

  list(): Behavior[] {
    return [...this.behaviors.values()];
  }
}
