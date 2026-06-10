import { NullEngine, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import { BobBehavior } from "./bob";

describe("Babylon BobBehavior", () => {
  it("has the bob definition", () => {
    expect(new BobBehavior().definition.type).toBe("bob");
  });

  it("tick sets position to base + amp*sin(2π f t)", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const node = new TransformNode("n", scene);
    node.position = new Vector3(0, 0, 0);
    const params = { axis: "y" as const, amplitude: 2, frequency: 1 };
    const b = new BobBehavior();
    const handle = b.install(node, params);
    b.tick!(node, params, handle, 0.25); // sin(π/2)=1 → y=2
    expect(node.position.y).toBeCloseTo(2, 6);
    b.tick!(node, params, handle, 0.25); // elapsed 0.5, sin(π)=0 → y=0
    expect(node.position.y).toBeCloseTo(0, 6);
    scene.dispose();
    engine.dispose();
  });
});
