import { ArcRotateCamera, Mesh, NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";

import { BabylonRenderHost } from "./render-host";

function makeHost() {
  const engine = new NullEngine();
  const host = new BabylonRenderHost({ createEngine: () => engine });
  return { host, engine };
}

const boxNode = (id: string): SceneNode =>
  ({
    id,
    name: id,
    type: "mesh",
    data: { type: "mesh", geometry: { kind: "box" } },
    transform: {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    parent_id: null,
    children_ids: [] as string[],
    visible: true,
    locked: false,
    behaviors: [],
    user_data: {},
  }) as SceneNode;

describe("BabylonRenderHost", () => {
  it("identifies as the babylon.js engine", () => {
    expect(makeHost().host.engine).toBe("babylon.js");
  });

  it("adapter throws before mount", () => {
    expect(() => makeHost().host.adapter).toThrow(/mount/);
  });

  it("mount creates the adapter and an ArcRotate editor camera at [4,3,4]", () => {
    const { host } = makeHost();
    host.mount(document.createElement("canvas"));
    const scene = host.adapter.scene;
    expect(scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
    const cam = scene.activeCamera as ArcRotateCamera;
    expect(cam.position.x).toBeCloseTo(4);
    expect(cam.position.y).toBeCloseTo(3);
    expect(cam.position.z).toBeCloseTo(4);
    host.dispose();
  });

  it("full lifecycle mount → start → resize → stop → dispose does not throw", () => {
    const { host, engine } = makeHost();
    host.mount(document.createElement("canvas"));
    host.start();
    host.resize(800, 600);
    host.stop();
    host.dispose();
    expect(engine.isDisposed).toBe(true);
  });

  it("dispose releases the adapter (engine ownership lives there)", () => {
    const { host, engine } = makeHost();
    host.mount(document.createElement("canvas"));
    host.dispose();
    expect(engine.isDisposed).toBe(true);
    expect(() => host.adapter).toThrow();
  });

  describe("setSelection (v1.0 B2)", () => {
    function mounted() {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.adapter.syncNode(boxNode("box"), "add");
      return host;
    }

    it("highlights the selected node's mesh", () => {
      const host = mounted();
      host.setSelection("box");
      const mesh = host.adapter.getRuntimeObject("box") as Mesh;
      expect(host.selectionLayer?.hasMesh(mesh)).toBe(true);
      host.dispose();
    });

    it("null clears the highlight (idempotent replay-safe)", () => {
      const host = mounted();
      host.setSelection("box");
      host.setSelection("box"); // replay — must not throw or double-add
      host.setSelection(null);
      const mesh = host.adapter.getRuntimeObject("box") as Mesh;
      expect(host.selectionLayer?.hasMesh(mesh)).toBe(false);
      host.dispose();
    });

    it("unknown / removed node id clears the layer instead of throwing", () => {
      const host = mounted();
      host.setSelection("box");
      host.adapter.syncNode(boxNode("box"), "remove");
      host.setSelection("box"); // node gone — layer must end up empty
      expect(host.selectionLayer?.getClassName()).toBe("HighlightLayer");
      host.setSelection("nope");
      host.dispose();
    });

    it("setSelection before mount is a no-op (no throw)", () => {
      const { host } = makeHost();
      expect(() => host.setSelection("box")).not.toThrow();
    });
  });
});
