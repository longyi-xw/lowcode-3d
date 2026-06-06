import { describe, expect, it } from "vitest";

import { ADD_BEHAVIOR } from "@/core/command/commands/add-behavior";
import { ADD_NODE } from "@/core/command/commands/add-node";

import { buildLightNode, normalizeColor, sceneEditSkill } from "./scene-edit";
import { SkillError } from "./types";

const lightOp = {
  op: "add_light" as const,
  light_kind: "directional" as const,
  color: "#ffe8c0",
  intensity: 1.2,
  position: [5, 6, 4] as [number, number, number],
  cast_shadow: true,
};
const behaviorOp = {
  op: "add_behavior" as const,
  behavior_type: "auto-rotate" as const,
};

describe("normalizeColor", () => {
  it("passes hex through, maps names, expands #rgb, falls back to white", () => {
    expect(normalizeColor("#ffe8c0")).toBe("#ffe8c0");
    expect(normalizeColor("white")).toBe("#ffffff");
    expect(normalizeColor("Warm White")).toBe("#ffe8c0");
    expect(normalizeColor("#f0a")).toBe("#ff00aa");
    expect(normalizeColor("banana")).toBe("#ffffff");
  });
});

describe("scene-edit parse (zod)", () => {
  it("accepts add_light + add_behavior operations", () => {
    const ops = sceneEditSkill.parse({ operations: [lightOp, behaviorOp] });
    expect(ops).toHaveLength(2);
    expect(ops[0]!.op).toBe("add_light");
    expect(ops[1]!.op).toBe("add_behavior");
  });

  it("rejects an unknown op", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ ...lightOp, op: "delete_all" }] }),
    ).toThrow();
  });

  it("rejects a missing required field", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ op: "add_light", light_kind: "point" }] }),
    ).toThrow();
  });

  it("accepts a color name (normalized later)", () => {
    expect(() =>
      sceneEditSkill.parse({ operations: [{ ...lightOp, color: "white" }] }),
    ).not.toThrow();
  });
});

describe("scene-edit buildLightNode", () => {
  it("maps an op to a light SceneNode + normalizes the color", () => {
    const node = buildLightNode({ ...lightOp, color: "warm white" });
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
  it("builds an AddNodeCommand for add_light", () => {
    const cmds = sceneEditSkill.buildCommands([lightOp], { selectedNodeId: null });
    expect(cmds).toHaveLength(1);
    expect(cmds[0]!.type).toBe(ADD_NODE);
    expect((cmds[0]!.payload as { node: { type: string } }).node.type).toBe("light");
  });

  it("builds an AddBehaviorCommand on the selected node for add_behavior", () => {
    const cmds = sceneEditSkill.buildCommands([behaviorOp], { selectedNodeId: "n1" });
    expect(cmds[0]!.type).toBe(ADD_BEHAVIOR);
    const p = cmds[0]!.payload as {
      node_id: string;
      binding: { behavior_type: string; parameters: { axis: string } };
    };
    expect(p.node_id).toBe("n1");
    expect(p.binding.behavior_type).toBe("auto-rotate");
    expect(p.binding.parameters.axis).toBe("y"); // default params
  });

  it("throws SkillError(no_target) for add_behavior with no selection", () => {
    expect(() =>
      sceneEditSkill.buildCommands([behaviorOp], { selectedNodeId: null }),
    ).toThrow(SkillError);
  });
});
