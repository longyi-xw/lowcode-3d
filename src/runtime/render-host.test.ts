import { describe, expect, it } from "vitest";

import { engineCapabilities } from "./render-host";

describe("engineCapabilities", () => {
  it("enables gizmo on both engines (B3b)", () => {
    expect(engineCapabilities("three.js").gizmo).toBe(true);
    expect(engineCapabilities("babylon.js").gizmo).toBe(true);
  });
  it("keeps play/focus/assetDrop Three-only (B4)", () => {
    const b = engineCapabilities("babylon.js");
    expect(b.play).toBe(false);
    expect(b.focus).toBe(false);
    expect(b.assetDrop).toBe(false);
    const t = engineCapabilities("three.js");
    expect(t.play && t.focus && t.assetDrop).toBe(true);
  });
});
