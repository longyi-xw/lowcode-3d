import { describe, expect, it } from "vitest";
import { transformsEqual } from "./transform-util";
import type { Transform } from "@/core/scene/types";

describe("transformsEqual", () => {
  it("true for identical, false for any differing component", () => {
    const a: Transform = {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
    expect(transformsEqual(a, { ...a })).toBe(true);
    expect(transformsEqual(a, { ...a, position: [0, 1, 0] })).toBe(false);
    expect(transformsEqual(a, { ...a, rotation: [0, 0, 1, 0] })).toBe(false);
  });
});
