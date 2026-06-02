import type * as THREE from "three";
import { z } from "zod";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

import type { Behavior, BehaviorContext, BehaviorHandle } from "./types";

const AxisSchema = z.enum(["x", "y", "z"]);
const ParamsSchema = z.object({
  axis: AxisSchema,
  speed: z.number(),
});

type Params = z.infer<typeof ParamsSchema>;

const DEG2RAD = Math.PI / 180;

export class AutoRotateBehavior implements Behavior<Params> {
  readonly definition: BehaviorDefinition = {
    type: "auto-rotate",
    name: "Auto Rotate",
    description: "Rotates the node around a local axis at a constant angular velocity.",
    parameters_schema: ParamsSchema,
  };

  install(
    _object: THREE.Object3D,
    _params: Params,
    _ctx: BehaviorContext,
  ): BehaviorHandle {
    return {};
  }

  tick(
    object: THREE.Object3D,
    params: Params,
    _handle: BehaviorHandle,
    dt: number,
  ): void {
    object.rotation[params.axis] += params.speed * DEG2RAD * dt;
  }

  emit(varName: string, params: Params, _ctx: CodegenContext): string {
    // Lines start at column 0; scene-codegen's pushBlock() prefixes each
    // line with the surrounding indent. The block is wrapped in `{}` so
    // multiple auto-rotate bindings on the same node don't collide.
    // `tickers` is declared by the scene-codegen prolog (`const tickers = []`)
    // and drained in the emitter main.js animate loop — those wirings land in
    // tasks A6 / A9 of this stage.
    return [
      `{`,
      `  const _omega = ${params.speed} * Math.PI / 180;`,
      `  tickers.push((dt) => { ${varName}.rotation.${params.axis} += _omega * dt; });`,
      `}`,
    ].join("\n");
  }
}
