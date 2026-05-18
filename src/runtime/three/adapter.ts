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
 *   - `pickAt` — raycasts against the live scene tree; requires the viewport
 *     to keep `setViewportSize` in sync (renderer size update path).
 *   - `getRuntimeObject` / `dispose` — implemented.
 *   - `syncAsset` / `exportProject` / `generateBehaviorCode` — still throw
 *     `NotImplementedYet`. They land in their own commits.
 *
 * Callers should `dispose()` before discarding to release Three.js handles.
 */
export class ThreeAdapter implements IRuntimeAdapter {
  readonly target: RuntimeTarget;
  readonly scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  /** SceneNode.id → Three.js Object3D mirror. Populated by syncNode. */
  protected readonly objects = new Map<string, THREE.Object3D>();

  /** Pixel dimensions of the viewport canvas. Updated by the viewport on every
   *  ResizeObserver tick so pickAt can convert screen coords to NDC. */
  private viewportWidth = 1;
  private viewportHeight = 1;

  /** Reused per pick to avoid per-event allocations. */
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

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

  /** Mounted viewport updates this whenever the canvas resizes, so pickAt can
   *  convert pixel coords to normalized device coords without owning the DOM. */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
  }

  /**
   * Raycast the scene at `(screen_x, screen_y)` in viewport-pixel space.
   * Returns the SceneNode.id of the nearest hit, walking up the Object3D
   * parent chain when the immediate hit is a child mesh of a SceneNode mirror.
   * Returns null when the ray hits empty space.
   */
  pickAt(screen_x: number, screen_y: number): string | null {
    if (this.viewportWidth <= 0 || this.viewportHeight <= 0) return null;
    // setFromCamera reads camera.matrixWorld directly — refresh it in case the
    // viewport's render loop hasn't ticked yet (e.g. during a synchronous
    // click handler that fires before requestAnimationFrame).
    this.camera.updateMatrixWorld(true);
    this.ndc.set(
      (screen_x / this.viewportWidth) * 2 - 1,
      -((screen_y / this.viewportHeight) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits.length === 0) return null;

    for (const hit of hits) {
      const nodeId = findNodeId(hit.object);
      if (nodeId !== null) return nodeId;
    }
    return null;
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

/** Walk up from an intersected Object3D to the nearest ancestor carrying a
 *  SceneNode.id in userData. Returns null if no ancestor has one (e.g., the
 *  hit was on a child mesh of a glTF asset that hasn't been tagged yet). */
function findNodeId(object: THREE.Object3D | null): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const id = current.userData?.nodeId;
    if (typeof id === "string") return id;
    current = current.parent;
  }
  return null;
}
