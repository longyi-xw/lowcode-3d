import { describe, expect, it } from "vitest";

import { ADD_NODE } from "@/core/command/commands/add-node";

import { buildLightNode, sceneEditSkill } from "./scene-edit";

const validOp = {
  op: "add_light" as const,
  light_kind: "directional" as const,
  color: "#ffe8c0",
  intensity: 1.2,
  position: [5, 6, 4] as [number, number, number],
  cast_shadow: true,
};

describe("scene-edit parse (zod)", () => {
  it("accepts a valid operations payload", () => {
    const ops = sceneEditSkill.parse({ operations: [validOp] });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "add_light", light_kind: "directional" });
  });

  it("rejects a non-hex color", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ ...validOp, color: "warm white" }] }),
    ).toThrow();
  });

  it("rejects an unknown op", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ ...validOp, op: "delete_all" }] }),
    ).toThrow();
  });

  it("rejects a missing required field", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ op: "add_light", light_kind: "point" }] }),
    ).toThrow();
  });
});

describe("scene-edit buildLightNode", () => {
  it("maps an op to a light SceneNode", () => {
    const node = buildLightNode(validOp);
    expect(node.type).toBe("light");
    expect(node.transform.position).toEqual([5, 6, 4]);
    expect(node.data).toMatchObject({
      type: "light",
      light_kind: "directional",
      color: "#ffe8c0",
      intensity: 1.2,
      cast_shadow: true,
    });
    expect(node.id).toBeTruthy();
  });
});

describe("scene-edit buildCommands", () => {
  it("builds one AddNodeCommand per op with a light node", () => {
    const cmds = sceneEditSkill.buildCommands([
      validOp,
      { ...validOp, light_kind: "point" },
    ]);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]!.type).toBe(ADD_NODE);
    expect((cmds[0]!.payload as { node: { type: string } }).node.type).toBe("light");
  });
});
