import {
  Quaternion,
  type Node as BabylonNode,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { z } from "zod";

import type { BehaviorDefinition } from "@/runtime/adapter";

import type { BabylonBehavior, BabylonBehaviorHandle } from "./types";

const ParamsSchema = z.object({ axis: z.enum(["x", "y", "z"]), speed: z.number() });
type Params = z.infer<typeof ParamsSchema>;

const DEG2RAD = Math.PI / 180;
const AXIS_VEC: Record<Params["axis"], Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

export class AutoRotateBehavior implements BabylonBehavior<Params> {
  readonly definition: BehaviorDefinition = {
    type: "auto-rotate",
    name: "Auto Rotate",
    description: "Rotates the node around a local axis at a constant angular velocity.",
    parameters_schema: ParamsSchema,
  };

  install(_node: BabylonNode, _params: Params): BabylonBehaviorHandle {
    return {};
  }

  tick(
    node: BabylonNode,
    params: Params,
    _handle: BabylonBehaviorHandle,
    dt: number,
  ): void {
    if (!(node instanceof TransformNode)) return;
    const delta = Quaternion.RotationAxis(
      AXIS_VEC[params.axis],
      params.speed * DEG2RAD * dt,
    );
    const cur = node.rotationQuaternion ?? Quaternion.Identity();
    node.rotationQuaternion = delta.multiply(cur);
  }
}
