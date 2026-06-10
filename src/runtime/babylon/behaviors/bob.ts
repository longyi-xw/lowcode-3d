import { type Node as BabylonNode, TransformNode } from "@babylonjs/core";
import { z } from "zod";

import type { BehaviorDefinition } from "@/runtime/adapter";

import type { BabylonBehavior, BabylonBehaviorHandle } from "./types";

const ParamsSchema = z.object({
  axis: z.enum(["x", "y", "z"]),
  amplitude: z.number(),
  frequency: z.number(),
});
type Params = z.infer<typeof ParamsSchema>;

interface BobHandle extends BabylonBehaviorHandle {
  base: number;
  elapsed: number;
}

const TWO_PI = Math.PI * 2;

export class BobBehavior implements BabylonBehavior<Params, BobHandle> {
  readonly definition: BehaviorDefinition = {
    type: "bob",
    name: "Bob",
    description: "Floats the node up and down along a local axis (sine wave).",
    parameters_schema: ParamsSchema,
  };

  install(node: BabylonNode, params: Params): BobHandle {
    const base = node instanceof TransformNode ? node.position[params.axis] : 0;
    return { base, elapsed: 0 };
  }

  tick(node: BabylonNode, params: Params, handle: BobHandle, dt: number): void {
    if (!(node instanceof TransformNode)) return;
    handle.elapsed += dt;
    node.position[params.axis] =
      handle.base +
      params.amplitude * Math.sin(TWO_PI * params.frequency * handle.elapsed);
  }
}
