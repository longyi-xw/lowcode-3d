import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BobBehavior } from "./bob";
import type { BehaviorContext } from "./types";

const ctx: BehaviorContext = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  domElement: null,
  raycaster: new THREE.Raycaster(),
};

describe("BobBehavior", () => {
  it("oscillates position around the install-time base on the chosen axis", () => {
    const b = new BobBehavior();
    const obj = new THREE.Object3D();
    obj.position.y = 2;
    const params = { axis: "y" as const, amplitude: 1, frequency: 1 };
    const handle = b.install(obj, params, ctx);
    // t = 0 → base
    b.tick!(obj, params, handle, 0);
    expect(obj.position.y).toBeCloseTo(2, 6);
    // quarter period (t = 1/(4f) = 0.25) → base + amplitude
    b.tick!(obj, params, handle, 0.25);
    expect(obj.position.y).toBeCloseTo(3, 5);
  });

  it("definition.type is bob", () => {
    expect(new BobBehavior().definition.type).toBe("bob");
  });

  it("emit pushes a ticker referencing the var + axis", () => {
    const code = new BobBehavior().emit(
      "n_x",
      { axis: "y", amplitude: 1, frequency: 1 },
      { project: {} as never, warnings: [], currentNodeVar: "n_x" },
    );
    expect(code).toContain("tickers.push");
    expect(code).toContain("n_x.position.y");
  });
});
