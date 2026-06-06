import { z } from "zod";

import { AddBehaviorCommand } from "@/core/command/commands/add-behavior";
import { AddNodeCommand } from "@/core/command/commands/add-node";
import type { Command } from "@/core/command/types";
import { generateUUID } from "@/core/id/uuid";
import type { BehaviorBinding, SceneNode } from "@/core/scene/types";

import {
  SkillError,
  type AddBehaviorOperation,
  type AddLightOperation,
  type Skill,
} from "./types";

const AddLightOpSchema = z.object({
  op: z.literal("add_light"),
  light_kind: z.enum(["directional", "point", "spot", "ambient"]),
  color: z.string(), // lenient — normalizeColor handles names/hex/fallback
  intensity: z.number().nonnegative(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  cast_shadow: z.boolean().optional(),
});
const AddBehaviorOpSchema = z.object({
  op: z.literal("add_behavior"),
  behavior_type: z.enum(["auto-rotate", "bob", "hover-highlight"]),
  parameters: z.record(z.string(), z.unknown()).optional(),
});
const OperationSchema = z.discriminatedUnion("op", [
  AddLightOpSchema,
  AddBehaviorOpSchema,
]);
const OperationsSchema = z.object({ operations: z.array(OperationSchema) });

/** JSON Schema sent to the LLM (aiComplete jsonSchema). A wide object keyed by
 *  `op`; each op uses its own fields (zod validates strictly per op). */
export const SCENE_EDIT_SCHEMA = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["add_light", "add_behavior"] },
          // add_light
          light_kind: {
            type: "string",
            enum: ["directional", "point", "spot", "ambient"],
          },
          color: { type: "string", description: "hex color, e.g. #ffe8c0" },
          intensity: { type: "number" },
          position: {
            type: "array",
            items: { type: "number" },
            minItems: 3,
            maxItems: 3,
          },
          cast_shadow: { type: "boolean" },
          // add_behavior (applies to the selected node)
          behavior_type: {
            type: "string",
            enum: ["auto-rotate", "bob", "hover-highlight"],
          },
          parameters: {
            type: "object",
            description: "behavior params, e.g. { axis: 'y', speed: 30 }",
          },
        },
        required: ["op"],
      },
    },
  },
  required: ["operations"],
} as const;

const SYSTEM_PROMPT = `You are a 3D scene assistant. The user describes a change; you return operations. Two op types:

add_light — add a light:
- Right-handed, Y up. "position" is the light's world coordinate; a directional light shines from its position toward the origin.
- Directions: "upper right"≈[5,6,4], "upper left"≈[-5,6,4], "top"≈[0,8,0], "front"≈[0,4,6], "back"≈[0,4,-6], "left"≈[-6,4,0], "right"≈[6,4,0], "horizontal"/"side"≈[6,2,0], "below"≈[0,-6,0].
- "color" MUST be a hex string #rrggbb. Convert color names: white=#ffffff, "warm white"=#ffe8c0, "cool white"=#dfe8ff, red=#ff0000, green=#00ff00, blue=#0000ff, yellow=#ffff00.
- Reasonable intensity: directional ~1.0–1.5, point/spot ~1.0.

add_behavior — attach a behavior to the currently selected node:
- behavior_type: "auto-rotate" (spin around an axis; params { axis: "x"|"y"|"z", speed: degrees/sec }), "bob" (float up/down; { axis, amplitude, frequency }), "hover-highlight" ({ color, intensity }).
- "rotate around the Y axis" → { op:"add_behavior", behavior_type:"auto-rotate", parameters:{ axis:"y", speed:30 } }.

Always emit at least one operation when the user asks to add something. Return the result as structured data.

Examples:
- "add a warm white directional light from the upper right" → {"operations":[{"op":"add_light","light_kind":"directional","color":"#ffe8c0","intensity":1.2,"position":[5,6,4],"cast_shadow":true}]}
- "make the selected object spin around Y" → {"operations":[{"op":"add_behavior","behavior_type":"auto-rotate","parameters":{"axis":"y","speed":30}}]}`;

const BEHAVIOR_DEFAULTS: Record<
  AddBehaviorOperation["behavior_type"],
  Record<string, unknown>
> = {
  "auto-rotate": { axis: "y", speed: 30 },
  bob: { axis: "y", amplitude: 0.5, frequency: 1 },
  "hover-highlight": { color: "#ffaa00", intensity: 1 },
};

const COLOR_NAMES: Record<string, string> = {
  white: "#ffffff",
  "warm white": "#ffe8c0",
  "cool white": "#dfe8ff",
  "neutral white": "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ff69b4",
  cyan: "#00ffff",
  gray: "#808080",
  grey: "#808080",
};

/** Normalize an LLM color to #rrggbb: pass hex through, expand #rgb, map common
 *  names, else fall back to white. Keeps a vague LLM answer from producing an
 *  invalid material instead of a friendly result. */
export function normalizeColor(input: string): string {
  const s = input.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return COLOR_NAMES[s] ?? "#ffffff";
}

function lightName(kind: AddLightOperation["light_kind"]): string {
  return {
    directional: "Directional Light",
    point: "Point Light",
    spot: "Spot Light",
    ambient: "Ambient Light",
  }[kind];
}

export function buildLightNode(op: AddLightOperation): SceneNode {
  return {
    id: generateUUID(),
    name: lightName(op.light_kind),
    type: "light",
    transform: { position: op.position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: {
      type: "light",
      light_kind: op.light_kind,
      color: normalizeColor(op.color),
      intensity: op.intensity,
      ...(op.cast_shadow !== undefined ? { cast_shadow: op.cast_shadow } : {}),
    },
    behaviors: [],
    user_data: {},
  };
}

function behaviorBinding(op: AddBehaviorOperation): BehaviorBinding {
  return {
    id: generateUUID(),
    behavior_type: op.behavior_type,
    enabled: true,
    parameters: op.parameters ?? BEHAVIOR_DEFAULTS[op.behavior_type],
  };
}

export const sceneEditSkill: Skill = {
  id: "scene-edit",
  name: "Scene Edit",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: SCENE_EDIT_SCHEMA as unknown as Record<string, unknown>,
  parse: (json) => OperationsSchema.parse(json).operations,
  buildCommands: (ops, ctx): Command[] =>
    ops.map((op) => {
      if (op.op === "add_light") {
        return new AddNodeCommand({ node: buildLightNode(op) });
      }
      // add_behavior — targets the selected node
      if (!ctx.selectedNodeId) throw new SkillError("no_target");
      return new AddBehaviorCommand({
        node_id: ctx.selectedNodeId,
        binding: behaviorBinding(op),
      });
    }),
};
