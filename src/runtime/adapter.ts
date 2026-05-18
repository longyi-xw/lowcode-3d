import type { z } from "zod";

import type {
  AssetReference,
  BehaviorBinding,
  RuntimeTarget,
  SceneNode,
  SceneProject,
} from "@/core/scene/types";

/**
 * Operation hint for {@link IRuntimeAdapter.syncNode}. Lets an adapter take
 * fast paths — e.g. updating only a transform matrix on "update" instead of
 * rebuilding a subtree.
 */
export type SyncOp = "add" | "update" | "remove";

export interface ExportOptions {
  /** Absolute destination directory on disk. Tauri resolves it before passing. */
  destination_path: string;
  /** When true, the exporter emits AI-friendly comments and TODO markers. */
  include_dev_comments?: boolean;
}

export interface ExportResult {
  /** Relative-to-destination path → file content. Binary assets are Uint8Array. */
  files: Map<string, string | Uint8Array>;
  /** Non-fatal notes the UI should surface (e.g. "fell back to Lambert material"). */
  warnings: string[];
}

export interface CodegenContext {
  /** Snapshot of the project being exported. */
  project: SceneProject;
  /** Mutable: behaviors push warnings into this array as they generate. */
  warnings: string[];
}

export interface BehaviorDefinition {
  /** Stable identifier; matches {@link BehaviorBinding.behavior_type}. */
  readonly type: string;
  /** Friendly display name (use as an i18n key in callers). */
  readonly name: string;
  /** One-line description for the behavior picker. */
  readonly description: string;
  /** zod schema for {@link BehaviorBinding.parameters}. */
  readonly parameters_schema: z.ZodTypeAny;
}

/**
 * Runtime adapter contract — every supported tech stack implements this.
 *
 * See `design/framework/architecture.md` §4.1. The contract has two halves:
 *
 *   1. **Live editor sync** — keep the in-process runtime view in lockstep
 *      with the SceneProject as the user edits.
 *   2. **Export** — emit a self-contained, runnable project to disk.
 *
 * Notes:
 * - Methods may be sync OR async. Asset loading is async because it touches
 *   the filesystem / network; node sync is sync because the live editor
 *   needs a deterministic frame.
 * - `getRuntimeObject` returns `unknown` deliberately: adapters must not leak
 *   engine-specific types across the layer boundary. Callers that need the
 *   real type cast inside engine-specific code (e.g. transform controls).
 * - `pickAt` returns the SceneNode id under the screen point, or `null` when
 *   the cursor hits empty space.
 */
export interface IRuntimeAdapter {
  readonly target: RuntimeTarget;

  // ───── Editor sync ──────────────────────────────────────────────
  syncNode(node: SceneNode, op: SyncOp): void;
  syncAsset(asset: AssetReference): Promise<void>;

  getRuntimeObject(node_id: string): unknown;
  pickAt(screen_x: number, screen_y: number): string | null;

  // ───── Export ───────────────────────────────────────────────────
  exportProject(project: SceneProject, options: ExportOptions): Promise<ExportResult>;

  // ───── Behaviors ────────────────────────────────────────────────
  getSupportedBehaviors(): BehaviorDefinition[];
  generateBehaviorCode(binding: BehaviorBinding, context: CodegenContext): string;
}
