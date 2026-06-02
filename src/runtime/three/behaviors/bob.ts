import type * as THREE from "three";
import { z } from "zod";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

import type { Behavior, BehaviorContext, BehaviorHandle } from "./types";

const ParamsSchema = z.object({
  axis: z.enum(["x", "y", "z"]),
  amplitude: z.number(),
  frequency: z.number(),
});
type Params = z.infer<typeof ParamsSchema>;

/** Per-binding state: the position the node sat at when Play started, plus
 *  accumulated time. */
interface BobHandle extends BehaviorHandle {
  base: number;
  elapsed: number;
}

const TWO_PI = Math.PI * 2;

export class BobBehavior implements Behavior<Params, BobHandle> {
  readonly definition: BehaviorDefinition = {
    type: "bob",
    name: "Bob",
    description: "Floats the node up and down along a local axis (sine wave).",
    parameters_schema: ParamsSchema,
  };

  install(object: THREE.Object3D, params: Params, _ctx: BehaviorContext): BobHandle {
    return { base: object.position[params.axis], elapsed: 0 };
  }

  tick(object: THREE.Object3D, params: Params, handle: BobHandle, dt: number): void {
    handle.elapsed += dt;
    object.position[params.axis] =
      handle.base +
      params.amplitude * Math.sin(TWO_PI * params.frequency * handle.elapsed);
  }

  emit(varName: string, params: Params, _ctx: CodegenContext): string {
    return [
      `{`,
      `  const _base = ${varName}.position.${params.axis};`,
      `  let _t = 0;`,
      `  const _amp = ${params.amplitude};`,
      `  const _freq = ${params.frequency};`,
      `  tickers.push((dt) => {`,
      `    _t += dt;`,
      `    ${varName}.position.${params.axis} = _base + _amp * Math.sin(2 * Math.PI * _freq * _t);`,
      `  });`,
      `}`,
    ].join("\n");
  }
}
