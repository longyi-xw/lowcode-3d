import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { Behavior, BehaviorHandle } from "./types";
import { ThreeBehaviorRegistry } from "./registry";

function fakeBehavior(type: string): Behavior {
  return {
    definition: {
      type,
      name: type,
      description: "",
      parameters_schema: z.object({}),
    },
    install: (): BehaviorHandle => ({}),
    tick: () => {},
    emit: () => "",
  };
}

describe("ThreeBehaviorRegistry", () => {
  it("registers and retrieves a behavior by type", () => {
    const r = new ThreeBehaviorRegistry();
    const b = fakeBehavior("alpha");
    r.register(b);
    expect(r.get("alpha")).toBe(b);
  });

  it("returns undefined for unregistered types", () => {
    const r = new ThreeBehaviorRegistry();
    expect(r.get("nope")).toBeUndefined();
  });

  it("list() returns every registered behavior in insertion order", () => {
    const r = new ThreeBehaviorRegistry();
    const a = fakeBehavior("a");
    const b = fakeBehavior("b");
    r.register(a);
    r.register(b);
    expect(r.list()).toEqual([a, b]);
  });

  it("throws when registering a duplicate type", () => {
    const r = new ThreeBehaviorRegistry();
    r.register(fakeBehavior("dup"));
    expect(() => r.register(fakeBehavior("dup"))).toThrow(/duplicate type "dup"/);
  });
});

import { createThreeBehaviorRegistry } from "./index";

describe("createThreeBehaviorRegistry", () => {
  it("returns a registry pre-populated with auto-rotate", () => {
    const r = createThreeBehaviorRegistry();
    const ar = r.get("auto-rotate");
    expect(ar).toBeDefined();
    expect(ar?.definition.type).toBe("auto-rotate");
  });

  it("includes the v0.5 Stage C behaviors (bob, hover-highlight)", () => {
    const r = createThreeBehaviorRegistry();
    expect(r.get("bob")?.definition.type).toBe("bob");
    expect(r.get("hover-highlight")?.definition.type).toBe("hover-highlight");
    expect(r.list().length).toBe(3);
  });

  it("each call returns a fresh registry instance", () => {
    const a = createThreeBehaviorRegistry();
    const b = createThreeBehaviorRegistry();
    expect(a).not.toBe(b);
  });
});
