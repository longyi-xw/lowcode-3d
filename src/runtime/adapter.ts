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

/**
 * Identifier for an export emitter. Each target shapes the on-disk output:
 *   - `vite`           — full Vite project source (package.json + vite.config
 *                        + index.html + src/), user runs pnpm install && pnpm
 *                        dev. AI-collab friendly: open in Cursor / Copilot and
 *                        keep iterating.
 *   - `standalone-esm` — single index.html + main.js with an importmap
 *                        pointing three at esm.sh. Drop into any static
 *                        server (python -m http.server, npx serve) and it
 *                        just runs. Best for chat-share / demo sites.
 *
 * Future targets (e.g. `vite-build` for prebuilt dist/, `r3f` for a
 * react-three-fiber project, `babylon` for the Babylon adapter) plug into
 * the same {@link Exporter} interface — no new dispatch in the adapter.
 */
export type ExportTarget = "vite" | "standalone-esm";

export interface ExportOptions {
  /** Which emitter shape to produce. Defaults to "vite" on the adapter side
   *  if callers omit it. */
  target?: ExportTarget;
  /** When true, emitters include AI-friendly comments + TODO markers in the
   *  generated code so downstream LLMs can navigate the output more easily. */
  include_dev_comments?: boolean;
}

/**
 * Relative path → file content. Text payloads carry the actual file body;
 * binary entries describe an asset to copy from somewhere on disk (the
 * source project's `assets/<hash>.glb`, typically) rather than carry the
 * bytes in memory. Keeping binaries as path-references means the exporter
 * stays cheap even for projects with hundreds of MB of glTF assets, and the
 * Rust write side can use hardlinks where the filesystem supports them.
 */
export type ExportFile =
  | { kind: "text"; content: string }
  | { kind: "asset_copy"; source_relative_path: string };

export interface ExportResult {
  files: Map<string, ExportFile>;
  /** Non-fatal notes the UI should surface (e.g. "fell back to Lambert
   *  material", "skipped helper grid-1 — helpers are editor-only"). */
  warnings: string[];
}

/**
 * Stateless emitter — takes a SceneProject snapshot and returns the files
 * that make up the export. Concrete emitters live in
 * `src/runtime/three/export/<target>.ts`; the adapter dispatches based on
 * `ExportOptions.target`. Future targets register an entry here.
 */
export interface Exporter {
  readonly target: ExportTarget;
  emit(
    project: SceneProject,
    options: ExportOptions,
    generateBehaviorCode: (binding: BehaviorBinding, ctx: CodegenContext) => string,
  ): ExportResult;
}

export interface CodegenContext {
  /** Snapshot of the project being exported. */
  project: SceneProject;
  /** Mutable: behaviors push warnings into this array as they generate. */
  warnings: string[];
  /**
   * The runtime variable name for the SceneNode currently being emitted.
   * Set by scene-codegen before delegating to a Behavior.emit.
   *
   * **Authority note:** A Behavior's emit method also receives `varName` as
   * its first parameter, which carries the same value. The explicit
   * `varName` parameter is the authoritative source for emit
   * implementations; `ctx.currentNodeVar` exists so future emit utilities
   * (helpers shared across behaviors) can pick it up without threading it
   * through every helper signature.
   */
  currentNodeVar: string;
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
