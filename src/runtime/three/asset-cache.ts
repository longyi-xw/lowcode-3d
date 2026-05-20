import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { AssetReference } from "@/core/scene/types";
import { commands } from "@/bindings/tauri";
import { isTauri } from "@/lib/runtime";

/**
 * Lazy, in-memory cache of parsed glTF asset templates.
 *
 * For every `AssetReference` of kind "geometry" that lives under a project's
 * `assets/` folder, this cache holds:
 *   1. the original bytes (rare — only kept if asked for, e.g. by the
 *      exporter — *not* held here today)
 *   2. a `THREE.Group` "template" — the result of running the .glb through
 *      GLTFLoader.parse once. Prefab_instance nodes clone this template per
 *      instance so 50 copies of the same model share geometry + materials.
 *
 * Why a separate module from ThreeAdapter: the adapter owns the live scene,
 * but asset bytes are global to a project — multiple adapters (e.g. an
 * eventual preview pane) could share them. Keeping the cache standalone also
 * makes it trivially testable.
 */

export type AssetLoadStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; template: THREE.Group; summary: AssetSummary }
  | { status: "error"; error: AssetLoadError };

export interface AssetSummary {
  /** Total mesh count in the imported subtree (sub-meshes count individually). */
  meshCount: number;
  /** Maximum depth from the asset root to the deepest descendant. */
  treeDepth: number;
}

export type AssetLoadError =
  | { code: "no_project_path" }
  | { code: "io"; message: string }
  | { code: "parse"; message: string }
  | { code: "wrong_runtime" }
  | { code: "unsupported_kind"; kind: AssetReference["kind"] };

const loader = new GLTFLoader();

export class AssetCache {
  private readonly entries = new Map<string, AssetLoadStatus>();
  private projectPath: string | null = null;

  /** Read by `ensureLoaded` to resolve `relative_path` against the project
   *  root. The adapter owner is responsible for syncing this whenever the
   *  open project changes (typically via the scene store subscription). */
  setProjectPath(path: string | null): void {
    if (path === this.projectPath) return;
    this.projectPath = path;
    // Clearing is intentional: a different project's manifest may reuse an
    // asset id (e.g. "asset-cube" demo), so cached templates from the old
    // project must not leak.
    this.dispose();
  }

  get(assetId: string): AssetLoadStatus {
    return this.entries.get(assetId) ?? { status: "idle" };
  }

  /**
   * Load the asset if not already cached. Idempotent: concurrent calls for
   * the same asset return the in-flight promise so two prefab_instance nodes
   * referencing the same asset don't trigger two reads.
   */
  async ensureLoaded(asset: AssetReference): Promise<AssetLoadStatus> {
    const cached = this.entries.get(asset.id);
    if (cached?.status === "ready" || cached?.status === "error") return cached;
    if (cached?.status === "loading") {
      // Spin until ready/error — this is the rare race case where two
      // syncAsset calls land for the same asset before the first resolves.
      // Simpler than maintaining a per-asset promise map; ensureLoaded is
      // not on a hot path.
      while (this.entries.get(asset.id)?.status === "loading") {
        await new Promise((r) => setTimeout(r, 0));
      }
      return this.entries.get(asset.id) ?? { status: "idle" };
    }

    if (asset.kind !== "geometry") {
      const status: AssetLoadStatus = {
        status: "error",
        error: { code: "unsupported_kind", kind: asset.kind },
      };
      this.entries.set(asset.id, status);
      return status;
    }

    this.entries.set(asset.id, { status: "loading" });
    try {
      const bytes = await this.readBytes(asset.relative_path);
      const gltf = await parseGlb(bytes);
      const template = gltf.scene;
      const summary = summarize(template);
      const status: AssetLoadStatus = { status: "ready", template, summary };
      this.entries.set(asset.id, status);
      return status;
    } catch (e) {
      const error = toAssetError(e);
      const status: AssetLoadStatus = { status: "error", error };
      this.entries.set(asset.id, status);
      return status;
    }
  }

  /**
   * Clone the cached template, ready to be parented into the scene as a
   * prefab_instance's Object3D mirror. Returns null when the asset isn't
   * loaded — the prefab_instance builder falls back to a placeholder so the
   * scene stays renderable while loading is in flight.
   */
  cloneTemplate(assetId: string): THREE.Object3D | null {
    const status = this.entries.get(assetId);
    if (status?.status !== "ready") return null;
    // SkeletonUtils.clone is needed for skinned meshes, but our v1 import
    // doesn't differentiate yet. .clone(true) is fine for static geometry
    // and shares geometry/material references — which is exactly the
    // memory win the prefab model promises.
    return status.template.clone(true);
  }

  /** Drop every cached template + release THREE handles. Called on project
   *  switch and on adapter dispose. */
  dispose(): void {
    for (const entry of this.entries.values()) {
      if (entry.status === "ready") disposeTree(entry.template);
    }
    this.entries.clear();
  }

  private async readBytes(relativePath: string): Promise<ArrayBuffer> {
    if (!isTauri()) {
      throw new TauriRequiredError();
    }
    if (!this.projectPath) {
      throw new NoProjectPathError();
    }
    const result = await commands.readProjectAsset(this.projectPath, relativePath);
    if (result.status === "error") {
      throw new IoError(formatFolderError(result.error));
    }
    return base64ToArrayBuffer(result.data);
  }
}

class TauriRequiredError extends Error {
  constructor() {
    super("asset cache requires the Tauri runtime");
    this.name = "TauriRequiredError";
  }
}
class NoProjectPathError extends Error {
  constructor() {
    super("asset cache has no project path set");
    this.name = "NoProjectPathError";
  }
}
class IoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetIoError";
  }
}

function toAssetError(e: unknown): AssetLoadError {
  if (e instanceof TauriRequiredError) return { code: "wrong_runtime" };
  if (e instanceof NoProjectPathError) return { code: "no_project_path" };
  if (e instanceof IoError) return { code: "io", message: e.message };
  return {
    code: "parse",
    message: e instanceof Error ? e.message : String(e),
  };
}

function formatFolderError(err: {
  code: string;
  data?: Record<string, unknown>;
}): string {
  if (err.code === "io" && err.data && typeof err.data["message"] === "string") {
    return err.data["message"] as string;
  }
  return `${err.code}: ${JSON.stringify(err.data ?? {})}`;
}

function parseGlb(bytes: ArrayBuffer): Promise<{ scene: THREE.Group }> {
  return new Promise((resolve, reject) => {
    loader.parse(
      bytes,
      "",
      (gltf) => resolve({ scene: gltf.scene }),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function summarize(root: THREE.Object3D): AssetSummary {
  let meshCount = 0;
  let maxDepth = 0;
  function walk(obj: THREE.Object3D, depth: number) {
    if ((obj as THREE.Mesh).isMesh) meshCount += 1;
    if (depth > maxDepth) maxDepth = depth;
    for (const child of obj.children) walk(child, depth + 1);
  }
  walk(root, 0);
  return { meshCount, treeDepth: maxDepth };
}

export interface TemplateNodeDescription {
  name: string;
  kind: "group" | "mesh" | "other";
  children: TemplateNodeDescription[];
}

/**
 * Walk a loaded glTF template into a names-only preview tree the hierarchy
 * panel can render without holding Three.js handles. Caps depth at 4 so a
 * deeply-nested glTF doesn't flood the panel; the user can drill via a
 * future "unpack" command if they need full access.
 */
export function describeTemplate(root: THREE.Object3D): TemplateNodeDescription {
  function classify(obj: THREE.Object3D): "group" | "mesh" | "other" {
    if ((obj as THREE.Mesh).isMesh) return "mesh";
    if ((obj as THREE.Group).isGroup || obj.children.length > 0) return "group";
    return "other";
  }
  function walk(obj: THREE.Object3D, depth: number): TemplateNodeDescription {
    return {
      name: obj.name || `<unnamed ${classify(obj)}>`,
      kind: classify(obj),
      children: depth >= 4 ? [] : obj.children.map((child) => walk(child, depth + 1)),
    };
  }
  return walk(root, 0);
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const maybe = obj as Partial<{
      geometry: THREE.BufferGeometry;
      material: THREE.Material | THREE.Material[];
    }>;
    maybe.geometry?.dispose?.();
    if (Array.isArray(maybe.material)) maybe.material.forEach((m) => m.dispose?.());
    else maybe.material?.dispose?.();
  });
}
