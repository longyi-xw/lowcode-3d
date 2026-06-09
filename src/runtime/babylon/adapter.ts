import {
  Camera,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  NullEngine,
  PointLight,
  Quaternion,
  Scene,
  SpotLight,
  TransformNode,
  UniversalCamera,
  Vector3,
  type Node as BabylonNode,
} from "@babylonjs/core";

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

const BABYLON_TARGET: RuntimeTarget = { kind: "babylon.js", version: "9.11.0" };

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
  private readonly engine = new NullEngine();
  private readonly scene = new Scene(this.engine);
  private readonly objects = new Map<string, BabylonNode>();

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
      if (existing) {
        applyBabylonTransform(existing, node);
        existing.setEnabled(node.visible);
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
          object: createMesh(node.name, kind, this.scene),
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
    return info;
  }

  getRuntimeObject(node_id: string): unknown {
    return this.objects.get(node_id);
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
    this.objects.clear();
  }

  pickAt(_screen_x: number, _screen_y: number): string | null {
    return notImplemented("pickAt");
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
    return notImplemented("getSupportedBehaviors");
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

function createMesh(
  name: string,
  kind: NonNullable<Extract<NodeData, { type: "mesh" }>["geometry"]>["kind"],
  scene: Scene,
) {
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

function createLight(
  name: string,
  data: Extract<NodeData, { type: "light" }>,
  scene: Scene,
): BabylonNode {
  switch (data.light_kind) {
    case "directional":
      return new DirectionalLight(name, new Vector3(0, -1, 0), scene);
    case "point":
      return new PointLight(name, Vector3.Zero(), scene);
    case "spot":
      return new SpotLight(
        name,
        Vector3.Zero(),
        new Vector3(0, -1, 0),
        Math.PI / 4,
        1,
        scene,
      );
    case "ambient":
      return new HemisphericLight(name, new Vector3(0, 1, 0), scene);
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
