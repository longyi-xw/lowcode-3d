import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

// Keystone for v1.0a: the whole approach assumes Babylon's NullEngine can be
// constructed under vitest/jsdom with no WebGL / canvas. Prove it here before
// building the adapter on top.
describe("Babylon NullEngine headless", () => {
  it("constructs an engine + scene + transform node and reads back a position", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const node = new TransformNode("t", scene);
    node.position = new Vector3(1, 2, 3);
    expect([node.position.x, node.position.y, node.position.z]).toEqual([1, 2, 3]);
    scene.dispose();
    engine.dispose();
  });
});
