import type { z } from "zod";
import type {
  AssetReferenceSchema,
  BehaviorBindingSchema,
  NodeDataSchema,
  NodeKindSchema,
  QuatSchema,
  RuntimeTargetSchema,
  SceneGraphSchema,
  SceneNodeSchema,
  SceneProjectSchema,
  SocketSchema,
  TransformSchema,
  Vec3Schema,
} from "./schemas";

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Quat = z.infer<typeof QuatSchema>;
export type Transform = z.infer<typeof TransformSchema>;

export type RuntimeTarget = z.infer<typeof RuntimeTargetSchema>;

export type NodeKind = z.infer<typeof NodeKindSchema>;
export type NodeData = z.infer<typeof NodeDataSchema>;

/** Tree node — see `design/framework/architecture.md` §3.2. Renamed from `Node`
 * in the spec to avoid colliding with the DOM `Node` global. */
export type SceneNode = z.infer<typeof SceneNodeSchema>;

export type AssetReference = z.infer<typeof AssetReferenceSchema>;
export type BehaviorBinding = z.infer<typeof BehaviorBindingSchema>;
export type Socket = z.infer<typeof SocketSchema>;

export type SceneGraph = z.infer<typeof SceneGraphSchema>;
export type SceneProject = z.infer<typeof SceneProjectSchema>;
