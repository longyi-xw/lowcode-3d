import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { BabylonBehavior, BabylonBehaviorHandle } from "./types";
import { BabylonBehaviorRegistry } from "./registry";

function fakeBehavior(type: string): BabylonBehavior {
  return {
    definition: { type, name: type, description: "", parameters_schema: z.object({}) },
    install: (): BabylonBehaviorHandle => ({}),
    tick: () => {},
  };
}

describe("BabylonBehaviorRegistry", () => {
  it("registers and retrieves by type", () => {
    const r = new BabylonBehaviorRegistry();
    const b = fakeBehavior("alpha");
    r.register(b);
    expect(r.get("alpha")).toBe(b);
  });

  it("returns undefined for unregistered types", () => {
    expect(new BabylonBehaviorRegistry().get("nope")).toBeUndefined();
  });

  it("list() returns every registered behavior in insertion order", () => {
    const r = new BabylonBehaviorRegistry();
    const a = fakeBehavior("a");
    const b = fakeBehavior("b");
    r.register(a);
    r.register(b);
    expect(r.list()).toEqual([a, b]);
  });

  it("throws on duplicate type", () => {
    const r = new BabylonBehaviorRegistry();
    r.register(fakeBehavior("dup"));
    expect(() => r.register(fakeBehavior("dup"))).toThrow(/duplicate type "dup"/);
  });
});
