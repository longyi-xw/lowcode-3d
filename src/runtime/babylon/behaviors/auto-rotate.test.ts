import { NullEngine, Quaternion, Scene, TransformNode } from "@babylonjs/core";
import { describe, expect, it } from "vitest";

import { AutoRotateBehavior } from "./auto-rotate";

describe("Babylon AutoRotateBehavior", () => {
  it("has the auto-rotate definition", () => {
    expect(new AutoRotateBehavior().definition.type).toBe("auto-rotate");
  });

  it("tick rotates the node's quaternion around the axis", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const node = new TransformNode("n", scene);
    node.rotationQuaternion = Quaternion.Identity();
    const b = new AutoRotateBehavior();
    const handle = b.install(node, { axis: "y", speed: 90 });
    b.tick!(node, { axis: "y", speed: 90 }, handle, 1); // 90°/s · 1s = 90°
    expect(node.rotationQuaternion!.y).toBeCloseTo(Math.SQRT1_2, 5);
    expect(node.rotationQuaternion!.w).toBeCloseTo(Math.SQRT1_2, 5);
    scene.dispose();
    engine.dispose();
  });
});
