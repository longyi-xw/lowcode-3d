import {
  Camera,
  Color3,
  DirectionalLight,
  HemisphericLight,
  Light,
  Mesh,
  MeshBuilder,
  NullEngine,
  PBRMaterial,
  Plane,
  PointLight,
  Quaternion,
  Scene,
  SpotLight,
  TransformNode,
  UniversalCamera,
  Vector3,
  type AbstractEngine,
  type Node as BabylonNode,
} from "@babylonjs/core";

import { resolveMaterial, type MaterialOverride } from "@/core/scene/material";
import { applyPbrMaterial, createPbrMaterial } from "./material";

import type {
  AssetReference,
  BehaviorBinding,
  NodeData,
  RuntimeTarget,
  SceneNode,
  SceneProject,
} from "@/core/scene/types";
import type {
  BehaviorDefinition,
  CodegenContext,
  ExportOptions,
  ExportResult,
  IRuntimeAdapter,
  RuntimeNodeInfo,
  SyncOp,
} from "../adapter";
import {
  createBabylonBehaviorRegistry,
  type BabylonBehavior,
  type BabylonBehaviorHandle,
  type BabylonBehaviorRegistry,
} from "./behaviors";

const BABYLON_TARGET: RuntimeTarget = { kind: "babylon.js", version: "9.11.0" };

/** Shared y=0 ground plane (normal +y) for drop raycasts — mirrors
 *  ThreeAdapter's module-level GROUND_PLANE (avoids a per-call allocation). */
const BABYLON_GROUND_PLANE = Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up());

interface NodeMeta {
  nodeId: string;
  kind: RuntimeNodeInfo["kind"];
  lightKind?: RuntimeNodeInfo["lightKind"];
  cameraKind?: RuntimeNodeInfo["cameraKind"];
  geometryKind?: RuntimeNodeInfo["geometryKind"];
}

function notImplemented(method: string): never {
  throw new Error(`BabylonAdapter.${method}: not implemented in v1.0a`);
}

/**
 * Headless Babylon.js adapter (v1.0a). Implements the engine-neutral parts of
 * IRuntimeAdapter — syncNode for group/mesh/light/camera + describeNode — to
 * prove the contract holds for a second engine via the conformance suite.
 * Runs on a NullEngine (no WebGL / canvas). Live-editor + export + behavior
 * methods throw until later sub-stages.
 */
export class BabylonAdapter implements IRuntimeAdapter {
  readonly target = BABYLON_TARGET;
  /** Engine-specific escape hatch (mirrors ThreeAdapter.scene) — used by
   *  BabylonRenderHost to mount the editor camera. Not on IRuntimeAdapter. */
  readonly scene: Scene;
  private readonly engine: AbstractEngine;
  private readonly objects = new Map<string, BabylonNode>();
  private readonly behaviorRegistry: BabylonBehaviorRegistry =
    createBabylonBehaviorRegistry();
  private readonly behaviorRuntime = new Map<
    string,
    Map<
      string,
      { behavior: BabylonBehavior; params: unknown; handle: BabylonBehaviorHandle }
    >
  >();

  constructor(options?: { engine?: AbstractEngine }) {
    this.engine = options?.engine ?? new NullEngine();
    this.scene = new Scene(this.engine);
    // Project transforms are right-handed (three.js was the first engine and
    // glTF is RH); Babylon defaults to left-handed, which would mirror the
    // rendered scene on z. Raw stored values are unaffected, so headless
    // conformance/describeNode behavior does not change.
    this.scene.useRightHandedSystem = true;

    // Default editor camera (mirrors ThreeAdapter's defaultCamera convention:
    // position [4,3,4] looking at the origin, vertical fov 50°). scene.pick
    // needs an active camera even headless, and conformance asserts pick
    // parity against the same framing on both engines. BabylonRenderHost's
    // ArcRotateCamera takes over activeCamera on mount; this one stays in the
    // scene unused (scene.dispose cleans it up).
    const editorCamera = new UniversalCamera(
      "default-editor-camera",
      new Vector3(4, 3, 4),
      this.scene,
    );
    editorCamera.setTarget(Vector3.Zero());
    editorCamera.fov = (50 * Math.PI) / 180;
    editorCamera.minZ = 0.1;
    editorCamera.maxZ = 1000;
    this.scene.activeCamera = editorCamera;
  }

  syncNode(node: SceneNode, op: SyncOp): void {
    if (op === "remove") {
      const existing = this.objects.get(node.id);
      if (existing) {
        existing.dispose();
        this.objects.delete(node.id);
      }
      return;
    }
    if (op === "update") {
      const existing = this.objects.get(node.id);
      if (!existing) {
        // Match ThreeAdapter: updating an unregistered node is a caller bug,
        // not a silent no-op — keeps the contract symmetric across engines.
        throw new Error(
          `BabylonAdapter.syncNode: cannot update unknown node ${node.id}`,
        );
      }
      applyBabylonTransform(existing, node);
      existing.setEnabled(node.visible);
      if (node.data.type === "light") applyLightData(existing as Light, node.data);
      if (
        node.data.type === "mesh" &&
        existing instanceof Mesh &&
        existing.material instanceof PBRMaterial
      ) {
        applyPbrMaterial(
          existing.material,
          resolveMaterial(node.data.material_overrides?.[0]),
        );
      }
      return;
    }
    if (this.objects.get(node.id)) {
      throw new Error(`BabylonAdapter.syncNode: node ${node.id} already exists`);
    }
    const { object, meta } = this.create(node);
    object.metadata = meta;
    applyBabylonTransform(object, node);
    object.setEnabled(node.visible);
    if (node.parent_id !== null) {
      const parent = this.objects.get(node.parent_id);
      if (!parent) {
        throw new Error(
          `BabylonAdapter.syncNode: parent ${node.parent_id} not found for ${node.id}`,
        );
      }
      object.parent = parent;
    }
    this.objects.set(node.id, object);
  }

  private create(node: SceneNode): { object: BabylonNode; meta: NodeMeta } {
    const data = node.data;
    switch (data.type) {
      case "group":
        return {
          object: new TransformNode(node.name, this.scene),
          meta: { nodeId: node.id, kind: "group" },
        };
      case "mesh": {
        const kind = data.geometry?.kind ?? "box";
        return {
          object: createMesh(node.name, kind, this.scene, data.material_overrides?.[0]),
          meta: { nodeId: node.id, kind: "mesh", geometryKind: kind },
        };
      }
      case "light":
        return {
          object: createLight(node.name, data, this.scene),
          meta: { nodeId: node.id, kind: "light", lightKind: data.light_kind },
        };
      case "camera":
        return {
          object: createCamera(node.name, data, this.scene),
          meta: { nodeId: node.id, kind: "camera", cameraKind: data.camera_kind },
        };
      case "helper":
      case "prefab_instance":
      case "custom":
        return {
          object: new TransformNode(node.name, this.scene),
          meta: { nodeId: node.id, kind: "unknown" },
        };
    }
  }

  describeNode(node_id: string): RuntimeNodeInfo | null {
    const obj = this.objects.get(node_id);
    if (!obj) return null;
    const meta = (obj.metadata ?? {}) as NodeMeta;
    const t = obj as unknown as {
      position?: Vector3;
      rotationQuaternion?: Quaternion | null;
      scaling?: Vector3;
    };
    const pos = t.position ?? Vector3.Zero();
    const q = t.rotationQuaternion;
    const scl = t.scaling ?? new Vector3(1, 1, 1);
    const parentMeta = obj.parent?.metadata as NodeMeta | undefined;
    const info: RuntimeNodeInfo = {
      kind: meta.kind ?? "unknown",
      position: [pos.x, pos.y, pos.z],
      rotation: q ? [q.x, q.y, q.z, q.w] : [0, 0, 0, 1],
      scale: [scl.x, scl.y, scl.z],
      visible: obj.isEnabled(false),
      parentId: parentMeta?.nodeId ?? null,
    };
    if (meta.lightKind) info.lightKind = meta.lightKind;
    if (meta.cameraKind) info.cameraKind = meta.cameraKind;
    if (meta.geometryKind) info.geometryKind = meta.geometryKind;
    if (obj instanceof Mesh && obj.material instanceof PBRMaterial) {
      const mat = obj.material;
      info.material = {
        color: mat.albedoColor.toHexString().toLowerCase(),
        metalness: mat.metallic ?? 0,
        roughness: mat.roughness ?? 0,
        emissive: mat.emissiveColor.toHexString().toLowerCase(),
        emissive_intensity: mat.emissiveIntensity,
        opacity: mat.alpha,
      };
    }
    return info;
  }

  getRuntimeObject(node_id: string): unknown {
    return this.objects.get(node_id);
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
    this.objects.clear();
    this.behaviorRuntime.clear();
  }

  /**
   * Pick the SceneNode under `(screen_x, screen_y)` in viewport-pixel space.
   * scene.pick unprojects against engine.getRenderWidth/Height — on a real
   * Engine that is the canvas pixel size, i.e. the same coordinate contract
   * as ThreeAdapter.pickAt. Babylon recomputes view/world matrices lazily,
   * so no manual refresh is needed (verified headless on NullEngine).
   * Walks up the parent chain for metadata.nodeId, mirroring Three's
   * userData.nodeId convention. Returns null on empty space.
   */
  pickAt(screen_x: number, screen_y: number): string | null {
    const hit = this.scene.pick(screen_x, screen_y);
    if (!hit?.hit || !hit.pickedMesh) return null;
    return findNodeId(hit.pickedMesh);
  }

  raycastGroundPoint(
    screen_x: number,
    screen_y: number,
  ): [number, number, number] | null {
    const camera = this.scene.activeCamera;
    if (!camera) return null;
    const ray = this.scene.createPickingRay(
      screen_x,
      screen_y,
      null, // identity world transform (unproject from clip → world)
      camera,
    );
    const t = ray.intersectsPlane(BABYLON_GROUND_PLANE);
    // <= 0: Babylon clamps a slightly-negative (away-pointing) distance to 0
    // instead of returning null; treat 0/negative as a miss so an upward ray
    // never reports its own origin as the ground hit (parity with Three).
    if (t === null || t <= 0) return null;
    const p = ray.origin.add(ray.direction.scale(t));
    return [p.x, p.y, p.z];
  }

  syncAsset(_asset: AssetReference): Promise<void> {
    return Promise.reject(
      new Error("BabylonAdapter.syncAsset: not implemented in v1.0a"),
    );
  }
  exportProject(
    _project: SceneProject,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    return Promise.reject(
      new Error("BabylonAdapter.exportProject: not implemented in v1.0a"),
    );
  }
  getSupportedBehaviors(): BehaviorDefinition[] {
    return this.behaviorRegistry.list().map((b) => b.definition);
  }

  installBehaviors(node_id: string, bindings: BehaviorBinding[]): void {
    const node = this.objects.get(node_id);
    if (!node) return;
    const perNode = new Map<
      string,
      { behavior: BabylonBehavior; params: unknown; handle: BabylonBehaviorHandle }
    >();
    for (const binding of bindings) {
      if (!binding.enabled) continue;
      const b = this.behaviorRegistry.get(binding.behavior_type);
      if (!b) {
        console.warn(
          `installBehaviors: unknown behavior_type "${binding.behavior_type}"`,
        );
        continue;
      }
      const parsed = b.definition.parameters_schema.safeParse(binding.parameters);
      if (!parsed.success) {
        console.warn(
          `installBehaviors: invalid params on binding ${binding.id} (${binding.behavior_type})`,
        );
        continue;
      }
      try {
        const handle = b.install(node, parsed.data);
        perNode.set(binding.id, { behavior: b, params: parsed.data, handle });
      } catch (e) {
        console.error(`installBehaviors: install threw on ${binding.id}`, e);
      }
    }
    this.behaviorRuntime.set(node_id, perNode);
  }

  tickBehaviors(dt: number): void {
    for (const [node_id, perNode] of this.behaviorRuntime) {
      const node = this.objects.get(node_id);
      if (!node) continue;
      for (const entry of perNode.values()) {
        try {
          entry.behavior.tick?.(node, entry.params, entry.handle, dt);
        } catch (e) {
          console.error(`tickBehaviors: tick threw on node ${node_id}`, e);
        }
      }
    }
  }

  uninstallBehaviors(node_id: string): void {
    const perNode = this.behaviorRuntime.get(node_id);
    if (!perNode) return;
    for (const entry of perNode.values()) {
      try {
        entry.handle.dispose?.();
      } catch (e) {
        console.error("uninstallBehaviors: dispose threw", e);
      }
    }
    this.behaviorRuntime.delete(node_id);
  }

  generateBehaviorCode(_binding: BehaviorBinding, _context: CodegenContext): string {
    return notImplemented("generateBehaviorCode");
  }
}

function applyBabylonTransform(obj: BabylonNode, node: SceneNode): void {
  const t = obj as unknown as {
    position?: Vector3;
    rotationQuaternion?: Quaternion | null;
    scaling?: Vector3;
  };
  const [px, py, pz] = node.transform.position;
  if (t.position) t.position.set(px, py, pz);
  if ("rotationQuaternion" in obj) {
    const [x, y, z, w] = node.transform.rotation;
    t.rotationQuaternion = new Quaternion(x, y, z, w);
  }
  if (t.scaling) {
    const [sx, sy, sz] = node.transform.scale;
    t.scaling.set(sx, sy, sz);
  }
}

function buildMeshGeometry(
  name: string,
  kind: NonNullable<Extract<NodeData, { type: "mesh" }>["geometry"]>["kind"],
  scene: Scene,
): Mesh {
  switch (kind) {
    case "sphere":
      return MeshBuilder.CreateSphere(name, { diameter: 1 }, scene);
    case "plane":
      return MeshBuilder.CreatePlane(name, { size: 1 }, scene);
    case "cylinder":
      return MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1 }, scene);
    case "box":
    default:
      return MeshBuilder.CreateBox(name, { size: 1 }, scene);
  }
}

function createMesh(
  name: string,
  kind: NonNullable<Extract<NodeData, { type: "mesh" }>["geometry"]>["kind"],
  scene: Scene,
  materialOverride?: MaterialOverride,
): Mesh {
  const mesh = buildMeshGeometry(name, kind, scene);
  const mat = createPbrMaterial(name, scene);
  applyPbrMaterial(mat, resolveMaterial(materialOverride));
  mesh.material = mat;
  return mesh;
}

/** Babylon-local brightness factor applied on top of the node's intensity to
 *  match Three's lighting. Initial 1.0; smoke-tuned after sRGB + IBL land
 *  (B4d). Babylon PBR vs Three physical-light units may differ at equal
 *  intensity — this is the single knob to reconcile them. */
const BABYLON_LIGHT_SCALE = 1.0;

/** Apply engine-neutral light node data (intensity + color) onto a Babylon
 *  Light, mirroring Three's node-builders/light.ts (color + intensity on
 *  create and update). Babylon's createLight only default-constructs, so
 *  without this the node's intensity/color are ignored (pre-B4d gap). */
function applyLightData(
  light: Light,
  data: Extract<NodeData, { type: "light" }>,
): void {
  light.intensity = data.intensity * BABYLON_LIGHT_SCALE;
  light.diffuse = Color3.FromHexString(data.color);
}

function createLight(
  name: string,
  data: Extract<NodeData, { type: "light" }>,
  scene: Scene,
): BabylonNode {
  switch (data.light_kind) {
    case "directional": {
      const light = new DirectionalLight(name, new Vector3(0, -1, 0), scene);
      applyLightData(light, data);
      return light;
    }
    case "point": {
      const light = new PointLight(name, Vector3.Zero(), scene);
      applyLightData(light, data);
      return light;
    }
    case "spot": {
      const light = new SpotLight(
        name,
        Vector3.Zero(),
        new Vector3(0, -1, 0),
        Math.PI / 4,
        1,
        scene,
      );
      applyLightData(light, data);
      return light;
    }
    case "ambient": {
      const light = new HemisphericLight(name, new Vector3(0, 1, 0), scene);
      applyLightData(light, data);
      return light;
    }
  }
}

function createCamera(
  name: string,
  data: Extract<NodeData, { type: "camera" }>,
  scene: Scene,
): BabylonNode {
  const cam = new UniversalCamera(name, Vector3.Zero(), scene);
  cam.mode =
    data.camera_kind === "orthographic"
      ? Camera.ORTHOGRAPHIC_CAMERA
      : Camera.PERSPECTIVE_CAMERA;
  return cam;
}

/** Walk up the Babylon parent chain for the nearest synced node's id
 *  (metadata.nodeId is set by syncNode("add")). Mirrors the Three side's
 *  findNodeId-over-userData convention. */
function findNodeId(obj: BabylonNode | null): string | null {
  let cur: BabylonNode | null = obj;
  while (cur) {
    const meta = cur.metadata as NodeMeta | null | undefined;
    if (meta?.nodeId) return meta.nodeId;
    cur = cur.parent;
  }
  return null;
}
