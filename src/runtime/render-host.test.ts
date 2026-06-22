import { describe, expect, it } from "vitest";

import { engineCapabilities } from "./render-host";

describe("engineCapabilities", () => {
  it("enables all editing capabilities on both engines (B4c)", () => {
    for (const e of ["three.js", "babylon.js"] as const) {
      const c = engineCapabilities(e);
      expect(c.gizmo).toBe(true);
      expect(c.play).toBe(true);
      expect(c.focus).toBe(true);
      expect(c.assetDrop).toBe(true);
    }
  });
});
