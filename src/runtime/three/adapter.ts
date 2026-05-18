import * as THREE from "three";

import type {
  AssetReference,
  BehaviorBinding,
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
  SyncOp,
} from "../adapter";

import {
  applyMeta,
  applyTransform,
  buildObject,
  disposeSubtree,
  updateObject,
} from "./node-builders";

export interface ThreeAdapterOptions {
  /** Defaults applied when no camera node is present in the SceneProject. */
  defaultCamera?: {
    fov?: number;
    near?: number;
    far?: number;
    position?: [number, number, number];
    lookAt?: [number, number, number];
  };
}

const DEFAULT_TARGET: RuntimeTarget = {
  kind: "three.js",
  version: "0.184.0",
  module_format: "esm",
};

class NotImplementedYet extends Error {
  constructor(method: string, when: string) {
    super(`ThreeAdapter.${method} is not implemented yet (${when})`);
    this.name = "NotImplementedYet";
  }
}

/**
 * Three.js adapter — implements `IRuntimeAdapter` for the MVP renderer.
 *
 * Status:
 *   - `syncNode` (add / update / remove) — implemented for group / mesh /
 *     light / camera / helper. Mesh nodes render a placeholder cube until
 *     `syncAsset` wires real .glb loading; everything else is faithful.
 *   - `getRuntimeObject` / `dispose` — implemented.
 *   - `syncAsset` / `pickAt` / `exportProject` / `generateBehaviorCode` — still
 *     throw `NotImplementedYet`. `pickAt` lands with the viewport mount;
 *     `syncAsset` and `exportProject` land in their own commits.
 *
 * Callers should `dispose()` before discarding to release Three.js handles.
 */
export class ThreeAdapter implements IRuntimeAdapter {
  readonly target: RuntimeTarget;
  readonly scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  /** SceneNode.id → Three.js Object3D mirror. Populated by syncNode. */
  protected readonly objects = new Map<string, THREE.Object3D>();

  constructor(
    target: RuntimeTarget = DEFAULT_TARGET,
    options: ThreeAdapterOptions = {},
  ) {
    this.target = target;
    this.scene = new THREE.Scene();

    const defaults = options.defaultCamera ?? {};
    const camera = new THREE.PerspectiveCamera(
      defaults.fov ?? 50,
      1, // aspect — viewport updates on first resize
      defaults.near ?? 0.1,
      defaults.far ?? 1000,
    );
    camera.position.set(...(defaults.position ?? [4, 3, 4]));
    camera.lookAt(new THREE.Vector3(...(defaults.lookAt ?? [0, 0, 0])));
    this.camera = camera;
  }

  // ───── Editor sync ─────────────────────────────────────────────

  /**
   * Reflect a SceneNode change into the Three.js scene tree.
   *
   * Contract: callers add parents before children. The adapter throws if a
   * node references a parent it doesn't yet know about — silent fallbacks
   * hide bugs in the layer above.
   */
  syncNode(node: SceneNode, op: SyncOp): void {
    switch (op) {
      case "add":
        this.addNode(node);
        return;
      case "update":
        this.updateNode(node);
        return;
      case "remove":
        this.removeNode(node);
        return;
    }
  }

  private addNode(node: SceneNode): void {
    if (this.objects.has(node.id)) {
      throw new Error(`ThreeAdapter.syncNode("add"): node ${node.id} already exists`);
    }

    const obj = buildObject(node);
    applyTransform(obj, node.transform);
    applyMeta(obj, node);

    const parent = node.parent_id ? this.objects.get(node.parent_id) : this.scene;
    if (!parent) {
      throw new Error(
        `ThreeAdapter.syncNode("add"): parent ${node.parent_id} not found for node ${node.id}; ` +
          "callers must add parents before children",
      );
    }
    parent.add(obj);
    this.objects.set(node.id, obj);
  }

  private updateNode(node: SceneNode): void {
    const obj = this.objects.get(node.id);
    if (!obj) {
      throw new Error(`ThreeAdapter.syncNode("update"): node ${node.id} not found`);
    }
    applyTransform(obj, node.transform);
    applyMeta(obj, node);
    updateObject(obj, node);
  }

  private removeNode(node: SceneNode): void {
    const obj = this.objects.get(node.id);
    // Idempotent: removing an already-gone node is a no-op. Editor flows may
    // emit "remove" defensively (e.g., on project close) so failing here would
    // be noisier than helpful.
    if (!obj) return;

    obj.parent?.remove(obj);
    disposeSubtree(obj);
    this.objects.delete(node.id);
  }

  async syncAsset(_asset: AssetReference): Promise<void> {
    throw new NotImplementedYet("syncAsset", "next commit");
  }

  getRuntimeObject(node_id: string): THREE.Object3D | undefined {
    return this.objects.get(node_id);
  }

  pickAt(_screen_x: number, _screen_y: number): string | null {
    throw new NotImplementedYet("pickAt", "after viewport mounts");
  }

  // ───── Export ───────────────────────────────────────────────────

  async exportProject(
    _project: SceneProject,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    throw new NotImplementedYet("exportProject", "Phase 2");
  }

  // ───── Behaviors ───────────────────────────────────────────────

  getSupportedBehaviors(): BehaviorDefinition[] {
    return [];
  }

  generateBehaviorCode(_binding: BehaviorBinding, _context: CodegenContext): string {
    throw new NotImplementedYet("generateBehaviorCode", "no behaviors registered yet");
  }

  // ───── Lifecycle ───────────────────────────────────────────────

  /** Drops Three.js resources held by the adapter. Call before discarding. */
  dispose(): void {
    for (const obj of this.objects.values()) {
      obj.parent?.remove(obj);
      disposeSubtree(obj);
    }
    this.scene.clear();
    this.objects.clear();
  }
}
