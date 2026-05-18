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
 * **This commit lands the shell only.** The constructor wires up a `THREE.Scene`
 * and a default camera so a viewport React component can attach to them today;
 * the sync/export/picking surface throws `NotImplementedYet` until the next
 * commits in the Phase 1 sequence flesh them out:
 *
 *   - syncNode / syncAsset → "feat(runtime): wire syncNode for ThreeAdapter"
 *   - pickAt → "feat(runtime): three viewport with picking" (after viewport)
 *   - exportProject → Phase 2 (codegen lives in `./exporter/`)
 *
 * The constructor side-effects (allocating a Scene + camera) are intentional:
 * an adapter without those is useless to the viewport. Callers should `dispose()`
 * before discarding to release Three.js handles.
 */
export class ThreeAdapter implements IRuntimeAdapter {
  readonly target: RuntimeTarget;

  /** The live THREE.Scene mirroring the SceneProject. Read by the viewport
   *  component each frame. */
  readonly scene: THREE.Scene;

  /** Active camera. Replaced once a SceneNode of kind "camera" is marked main. */
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

  syncNode(_node: SceneNode, _op: SyncOp): void {
    throw new NotImplementedYet("syncNode", "next commit");
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
    // Real behaviors land in v0.5. Returning [] lets editor code index without
    // optional-chaining noise.
    return [];
  }

  generateBehaviorCode(_binding: BehaviorBinding, _context: CodegenContext): string {
    throw new NotImplementedYet("generateBehaviorCode", "no behaviors registered yet");
  }

  // ───── Lifecycle ───────────────────────────────────────────────

  /** Drops Three.js resources held by the adapter. Call before discarding. */
  dispose(): void {
    for (const obj of this.objects.values()) {
      this.scene.remove(obj);
    }
    this.scene.clear();
    this.objects.clear();
  }
}
