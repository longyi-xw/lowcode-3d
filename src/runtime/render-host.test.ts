import { describe, expect, it } from "vitest";

import { isEngineEditingCapable } from "./render-host";

describe("isEngineEditingCapable", () => {
  it("three.js viewport supports editing interactions", () => {
    expect(isEngineEditingCapable("three.js")).toBe(true);
  });

  it("babylon.js viewport is view-only in B1", () => {
    expect(isEngineEditingCapable("babylon.js")).toBe(false);
  });
});
