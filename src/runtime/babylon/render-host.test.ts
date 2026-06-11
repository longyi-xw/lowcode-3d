import { ArcRotateCamera, NullEngine } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import { BabylonRenderHost } from "./render-host";

function makeHost() {
  const engine = new NullEngine();
  const host = new BabylonRenderHost({ createEngine: () => engine });
  return { host, engine };
}

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
});
