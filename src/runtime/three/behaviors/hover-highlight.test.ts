import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { HoverHighlightBehavior } from "./hover-highlight";
import type { BehaviorContext } from "./types";

function makeCtx(domElement: HTMLElement | null): BehaviorContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    domElement,
    raycaster: new THREE.Raycaster(),
  };
}

function meshObj(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
}

const PARAMS = { color: "#ffaa00", intensity: 1 };

describe("HoverHighlightBehavior", () => {
  it("binds pointer listeners on install and removes them on dispose", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const remove = vi.spyOn(el, "removeEventListener");
    const handle = new HoverHighlightBehavior().install(meshObj(), PARAMS, makeCtx(el));
    expect(add).toHaveBeenCalled();
    handle.dispose?.();
    expect(remove).toHaveBeenCalledTimes(add.mock.calls.length);
  });

  it("no-ops (no throw) when domElement is null", () => {
    expect(() =>
      new HoverHighlightBehavior().install(meshObj(), PARAMS, makeCtx(null)),
    ).not.toThrow();
  });

  it("restores original emissive on dispose", () => {
    const el = document.createElement("div");
    const obj = meshObj();
    const mat = obj.material as THREE.MeshStandardMaterial;
    mat.emissive.set("#010203");
    const original = mat.emissive.getHex();
    const handle = new HoverHighlightBehavior().install(obj, PARAMS, makeCtx(el));
    mat.emissive.set("#ffaa00"); // simulate a hover having changed it
    handle.dispose?.();
    expect(mat.emissive.getHex()).toBe(original);
  });

  it("emit pushes into interactions (not tickers)", () => {
    const code = new HoverHighlightBehavior().emit("n_x", PARAMS, {
      project: {} as never,
      warnings: [],
      currentNodeVar: "n_x",
    });
    expect(code).toContain("interactions.push");
    expect(code).toContain("n_x");
  });
});
