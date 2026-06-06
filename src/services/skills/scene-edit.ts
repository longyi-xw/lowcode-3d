import { z } from "zod";

import { AddNodeCommand } from "@/core/command/commands/add-node";
import type { Command } from "@/core/command/types";
import { generateUUID } from "@/core/id/uuid";
import type { SceneNode } from "@/core/scene/types";

import type { AddLightOperation, Skill } from "./types";

const AddLightOpSchema = z.object({
  op: z.literal("add_light"),
  light_kind: z.enum(["directional", "point", "spot", "ambient"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  intensity: z.number().nonnegative(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  cast_shadow: z.boolean().optional(),
});
const OperationsSchema = z.object({ operations: z.array(AddLightOpSchema) });

/** JSON Schema sent to the LLM (aiComplete jsonSchema). Mirrors the zod shape. */
export const SCENE_EDIT_SCHEMA = {
  type: "object",
  properties: {
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["add_light"] },
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
        },
        required: ["op", "light_kind", "color", "intensity", "position"],
      },
    },
  },
  required: ["operations"],
} as const;

const SYSTEM_PROMPT = `You are a 3D scene lighting assistant. The user describes lighting they want; you return operations that add lights.

Scene conventions:
- Right-handed, Y up. A light's "position" is its world coordinate; a directional light shines from its position toward the origin.
- "upper right" ≈ [5, 6, 4]; "upper left" ≈ [-5, 6, 4]; "top" ≈ [0, 8, 0]; "front" ≈ [0, 4, 6].
- Colors are hex #rrggbb. "warm white" ≈ #ffe8c0, "cool white" ≈ #dfe8ff, "neutral white" ≈ #ffffff.
- Reasonable intensity: directional ~1.0–1.5, point/spot ~1.0.
- Only emit add_light operations. Return the result as structured data.

Example — "add a warm white directional light from the upper right":
{"operations":[{"op":"add_light","light_kind":"directional","color":"#ffe8c0","intensity":1.2,"position":[5,6,4],"cast_shadow":true}]}`;

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
      color: op.color,
      intensity: op.intensity,
      ...(op.cast_shadow !== undefined ? { cast_shadow: op.cast_shadow } : {}),
    },
    behaviors: [],
    user_data: {},
  };
}

export const sceneEditSkill: Skill = {
  id: "scene-edit",
  name: "Scene Edit",
  systemPrompt: SYSTEM_PROMPT,
  outputSchema: SCENE_EDIT_SCHEMA as unknown as Record<string, unknown>,
  parse: (json) => OperationsSchema.parse(json).operations,
  buildCommands: (ops): Command[] =>
    ops.map((op) => new AddNodeCommand({ node: buildLightNode(op) })),
};
