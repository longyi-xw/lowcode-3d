import { z } from "zod";

export const SPEC_VERSION = "0.1.0" as const;

// ─────────────────────── Primitives ───────────────────────

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const QuatSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const TransformSchema = z.object({
  position: Vec3Schema,
  rotation: QuatSchema, // quaternion [x, y, z, w]
  scale: Vec3Schema,
});

const ColorHexSchema = z
  .string()
  .regex(
    /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    "expected hex color #rrggbb or #rrggbbaa",
  );

// ─────────────────────── Runtime target ───────────────────────

export const RuntimeTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("three.js"),
    version: z.string(),
    module_format: z.enum(["esm", "cjs"]),
  }),
  z.object({
    kind: z.literal("babylon.js"),
    version: z.string(),
  }),
  z.object({
    kind: z.literal("unity"),
    version: z.string(),
    render_pipeline: z.enum(["urp", "hdrp", "builtin"]),
  }),
  z.object({
    kind: z.literal("react-three-fiber"),
    version: z.string(),
  }),
]);

// ─────────────────────── Node kind + data ───────────────────────

export const NodeKindSchema = z.enum([
  "group",
  "mesh",
  "light",
  "camera",
  "helper",
  "prefab_instance",
  "custom",
]);

const MaterialOverrideSchema = z.object({
  slot: z.number().int().nonnegative(),
  color: ColorHexSchema.optional(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  opacity: z.number().min(0).max(1).optional(),
  emissive: ColorHexSchema.optional(),
  emissive_intensity: z.number().nonnegative().optional(),
});

export const GeometryDescriptorSchema = z.object({
  kind: z.enum(["box", "sphere", "plane", "cylinder"]),
});

export const NodeDataSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("group") }),
  z.object({
    type: z.literal("mesh"),
    geometry: GeometryDescriptorSchema.optional(),
    asset_id: z.string().optional(),
    material_overrides: z.array(MaterialOverrideSchema).optional(),
  }),
  z.object({
    type: z.literal("light"),
    light_kind: z.enum(["directional", "point", "spot", "ambient"]),
    color: ColorHexSchema,
    intensity: z.number().nonnegative(),
    distance: z.number().nonnegative().optional(),
    decay: z.number().nonnegative().optional(),
    angle: z.number().optional(),
    penumbra: z.number().min(0).max(1).optional(),
    cast_shadow: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("camera"),
    camera_kind: z.enum(["perspective", "orthographic"]),
    fov: z.number().optional(),
    aspect: z.number().optional(),
    near: z.number().positive(),
    far: z.number().positive(),
    left: z.number().optional(),
    right: z.number().optional(),
    top: z.number().optional(),
    bottom: z.number().optional(),
  }),
  z.object({
    type: z.literal("helper"),
    helper_kind: z.string(),
  }),
  // Prefab_instance: a leaf SceneNode that references a glTF asset. The
  // sub-tree lives inside the cached template (loaded once per asset by
  // ThreeAdapter.syncAsset) and is cloned per instance at render time. This
  // keeps 50× duplicates of the same model from inflating the SceneGraph.
  // Per-instance overrides + unpack-to-tree are deferred to v2.
  z.object({
    type: z.literal("prefab_instance"),
    asset_id: z.string(),
  }),
  z.object({
    type: z.literal("custom"),
    custom_type: z.string(),
    payload: z.unknown(),
  }),
]);

// ─────────────────────── Behavior ───────────────────────

export const BehaviorBindingSchema = z.object({
  id: z.string(),
  behavior_type: z.string(),
  enabled: z.boolean(),
  parameters: z.record(z.string(), z.unknown()),
});

// ─────────────────────── Socket（v0.4 C：模块化拼装地基）───────────────────────

export const SocketSchema = z.object({
  id: z.string(), // 内部稳定键（仿 BehaviorBinding.id）
  name: z.string(), // 用户标签（如 "top"/"bottom"）
  position: Vec3Schema, // 节点局部坐标
  tag: z.string(), // 兼容分组；空串 = 不参与吸附
});

// ─────────────────────── Scene node ───────────────────────

// Renamed from architecture's `Node` to avoid clashing with the DOM `Node`
// global, which is always in lib.dom. The on-disk field name is unchanged.
export const SceneNodeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: NodeKindSchema,
    transform: TransformSchema,
    parent_id: z.string().nullable(),
    children_ids: z.array(z.string()),
    visible: z.boolean(),
    locked: z.boolean(),
    data: NodeDataSchema,
    behaviors: z.array(BehaviorBindingSchema),
    sockets: z.array(SocketSchema).optional(),
    user_data: z.record(z.string(), z.unknown()),
  })
  .refine((node) => node.type === node.data.type, {
    message: "node.type must equal node.data.type",
    path: ["type"],
  });

// ─────────────────────── Assets ───────────────────────

const AssetSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("builtin"),
    library_id: z.string(),
  }),
  z.object({
    kind: z.literal("user_upload"),
    original_filename: z.string(),
  }),
  z.object({
    kind: z.literal("online"),
    provider: z.string(),
    url: z.string(),
    license: z.string(),
  }),
  z.object({
    kind: z.literal("ai_generated"),
    model: z.string(),
    prompt: z.string(),
  }),
]);

export const AssetReferenceSchema = z.object({
  id: z.string(),
  content_hash: z.string(),
  kind: z.enum(["geometry", "texture", "hdri", "audio", "video"]),
  relative_path: z.string(),
  tags: z.array(z.string()),
  description: z.string(),
  source: AssetSourceSchema,
});

// ─────────────────────── Settings ───────────────────────

const ColorOrHDRISchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("color"),
    color: ColorHexSchema,
  }),
  z.object({
    kind: z.literal("hdri"),
    asset_id: z.string(),
  }),
]);

const ProjectSettingsSchema = z.object({
  units: z.enum(["meters", "centimeters"]),
  up_axis: z.enum(["y", "z"]),
  background: ColorOrHDRISchema,
});

// ─────────────────────── Project metadata + scene graph ───────────────────────

const ProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(), // ISO 8601 — stricter check happens in parse.ts
  updated_at: z.string(),
  target_runtime: RuntimeTargetSchema,
});

export const SceneGraphSchema = z.object({
  // Keyed by node id for O(1) lookup; serialized to disk one file per node.
  nodes: z.record(z.string(), SceneNodeSchema),
  root_node_ids: z.array(z.string()),
});

export const SceneProjectSchema = z.object({
  spec_version: z.literal(SPEC_VERSION),
  metadata: ProjectMetadataSchema,
  scene: SceneGraphSchema,
  assets: z.array(AssetReferenceSchema),
  settings: ProjectSettingsSchema,
});
