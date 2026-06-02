import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { AutoRotateBehavior } from "./auto-rotate";
import type { BehaviorContext } from "./types";

const ctx: BehaviorContext = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  domElement: null,
  raycaster: new THREE.Raycaster(),
};

describe("AutoRotateBehavior", () => {
  const b = new AutoRotateBehavior();

  it("exposes a stable definition", () => {
    expect(b.definition.type).toBe("auto-rotate");
    expect(b.definition.name).toBe("Auto Rotate");
    expect(typeof b.definition.description).toBe("string");
  });

  it("parses valid params", () => {
    const parsed = b.definition.parameters_schema.parse({ axis: "y", speed: 30 });
    expect(parsed).toEqual({ axis: "y", speed: 30 });
  });

  it("rejects invalid axis", () => {
    expect(() =>
      b.definition.parameters_schema.parse({ axis: "w", speed: 30 }),
    ).toThrow();
  });

  it("rejects non-number speed", () => {
    expect(() =>
      b.definition.parameters_schema.parse({ axis: "y", speed: "fast" }),
    ).toThrow();
  });

  it("install returns an empty handle (auto-rotate is stateless)", () => {
    const obj = new THREE.Object3D();
    const h = b.install(obj, { axis: "y", speed: 30 }, ctx);
    expect(h).toEqual({});
    expect(h.dispose).toBeUndefined();
  });

  it("tick advances rotation around the chosen axis by speed * deg2rad * dt", () => {
    const obj = new THREE.Object3D();
    const params = { axis: "y" as const, speed: 30 };
    const h = b.install(obj, params, ctx);
    b.tick!(obj, params, h, 1);
    expect(obj.rotation.y).toBeCloseTo((30 * Math.PI) / 180, 6);
    expect(obj.rotation.x).toBe(0);
    expect(obj.rotation.z).toBe(0);
  });

  it("tick supports negative speed", () => {
    const obj = new THREE.Object3D();
    const params = { axis: "x" as const, speed: -90 };
    const h = b.install(obj, params, ctx);
    b.tick!(obj, params, h, 0.5);
    expect(obj.rotation.x).toBeCloseTo(((-90 * Math.PI) / 180) * 0.5, 6);
  });

  it("emit returns code referencing tickers + varName", () => {
    const code = b.emit("n_abc", { axis: "y", speed: 30 }, {
      project: { metadata: {}, scene: {}, assets: [], settings: {} } as never,
      warnings: [],
      currentNodeVar: "n_abc",
    } as never);
    expect(code).toContain("tickers.push");
    expect(code).toContain("n_abc.rotation.y");
    expect(code).toContain("30");
    expect(code).toContain("Math.PI");
  });

  it("emit output, when evaluated, produces the same rotation as tick", () => {
    const obj1 = new THREE.Object3D();
    const obj2 = new THREE.Object3D();
    const params = { axis: "y" as const, speed: 30 };

    const h = b.install(obj1, params, ctx);
    b.tick!(obj1, params, h, 1);

    const tickers: ((dt: number) => void)[] = [];
    const code = b.emit("target", params, {
      project: {} as never,
      warnings: [],
      currentNodeVar: "target",
    } as never);
    new Function("tickers", "target", code)(tickers, obj2);
    for (const t of tickers) t(1);

    expect(obj2.rotation.y).toBeCloseTo(obj1.rotation.y, 6);
  });
});
