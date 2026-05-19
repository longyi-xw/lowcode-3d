import {
  deserializeProject,
  serializeProject,
  type PersistenceError,
} from "@/core/scene/persistence";
import type { SceneProject } from "@/core/scene/types";
import { commands, type FolderError } from "@/bindings/tauri";

/**
 * Bridge between the TS-side persistence (folder layout serialization) and the
 * Rust-side file I/O. Everything that touches disk goes through here so the UI
 * has one place to wire toasts / error handling.
 *
 * Why two error origins: persistence.ts can fail on schema parse (bad on-disk
 * project), and Rust can fail on filesystem (permission, missing path, etc).
 * `ProjectIoError` is the unified discriminated union so the UI handles both
 * with one switch.
 */

export type ProjectIoError =
  | { kind: "folder"; error: FolderError }
  | { kind: "persistence"; error: PersistenceError };

export type ProjectIoResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProjectIoError };

export async function saveProjectAt(
  path: string,
  project: SceneProject,
  overwrite = false,
): Promise<ProjectIoResult<void>> {
  let files: Record<string, string>;
  try {
    const serialized = serializeProject(project);
    files = Object.fromEntries(serialized);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: "persistence",
        error: {
          code: "schema",
          path: "(serialize)",
          message: e instanceof Error ? e.message : "serialize failed",
        },
      },
    };
  }

  const result = await commands.saveProjectFolder(path, files, overwrite);
  if (result.status === "error") {
    return { ok: false, error: { kind: "folder", error: result.error } };
  }
  await commands.setCurrentProjectPath(path);
  return { ok: true, value: undefined };
}

export async function openProjectAt(
  path: string,
): Promise<ProjectIoResult<SceneProject>> {
  const result = await commands.openProjectFolder(path);
  if (result.status === "error") {
    return { ok: false, error: { kind: "folder", error: result.error } };
  }
  const filesMap = new Map<string, string>(Object.entries(result.data));
  const deser = deserializeProject(filesMap);
  if (!deser.ok) {
    return { ok: false, error: { kind: "persistence", error: deser.error } };
  }
  await commands.setCurrentProjectPath(path);
  return { ok: true, value: deser.project };
}

export function formatProjectIoError(error: ProjectIoError): string {
  if (error.kind === "folder") {
    const { error: fe } = error;
    switch (fe.code) {
      case "io":
        return `${fe.data.message} (${fe.data.path})`;
      case "not_a_directory":
        return `Path is not a directory: ${fe.data.path}`;
      case "already_exists_not_empty":
        return `${fe.data.path} is not empty — overwrite?`;
      case "persistence":
        return fe.data.detail;
    }
  }
  const { error: pe } = error;
  switch (pe.code) {
    case "missing_file":
      return `Missing ${pe.path}`;
    case "json_syntax":
      return `Invalid JSON in ${pe.path}: ${pe.message}`;
    case "hierarchy":
      return pe.message;
    case "schema":
      return `Schema mismatch in ${pe.path}: ${pe.message}`;
  }
}
