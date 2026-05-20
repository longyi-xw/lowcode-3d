import { ask, open, save } from "@tauri-apps/plugin-dialog";

import { commands } from "@/bindings/tauri";
import { generateUUID } from "@/core/id/uuid";
import { isTauri } from "@/lib/runtime";
import type { AssetReference, SceneNode, SceneProject } from "@/core/scene/types";
import { useAppViewStore } from "@/services/app-view/store";
import { useCommandHistoryStore } from "@/services/command-history";
import { createDemoProject } from "@/services/scene/demo-project";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import {
  formatProjectIoError,
  openProjectAt,
  saveProjectAt,
  type ProjectIoError,
} from "./io";
import { useProjectStore } from "./store";

/**
 * The on-disk folder is the project's identity — its name is whatever the
 * user titled the folder. Treat `metadata.name` as a derived field that
 * resyncs from the folder basename every time the project's path changes
 * (save, save-as, open). Strip the conventional `.lowcode` / `.project`
 * suffix so a folder named `my-scene.lowcode` displays as `my-scene`.
 *
 * If the user later wants a name that diverges from the folder, that needs
 * an explicit rename UI which also renames the folder — out of scope for
 * Phase 2 Step #1.
 */
function deriveProjectNameFromPath(folderPath: string): string {
  const base = folderPath.split(/[\\/]/).filter(Boolean).pop() ?? "";
  const stripped = base.replace(/\.(lowcode|project)$/i, "");
  return stripped || base || "Untitled project";
}

function renameProject(project: SceneProject, nextName: string): SceneProject {
  if (project.metadata.name === nextName) return project;
  return {
    ...project,
    metadata: {
      ...project.metadata,
      name: nextName,
      updated_at: new Date().toISOString(),
    },
  };
}

/**
 * Project-level actions shared between three callers: StartupView buttons,
 * EditorView's close button, and the native File menu. Centralising the dirty
 * check + dialog + error toast here means the three entry points stay in
 * lockstep.
 *
 * Re-entrancy guard: every menu/button action takes seconds (file pickers,
 * confirm dialogs) and there are several paths where the same event can
 * land twice — menu accelerator + double-click, React Strict Mode listener
 * race during dev, HMR re-attaching handlers, an impatient user clicking
 * the menu item while the previous click's dialog is up. Two concurrent
 * `ask()` calls deadlock on macOS (the second native dialog steals focus
 * but the first one's promise never resolves), so we hard-gate each action
 * here. Granularity is per-action because Save during an in-flight Open is
 * fine — only same-action re-entry is the failure mode.
 */
const inFlight: Record<string, boolean> = {};

function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (inFlight[key]) return Promise.resolve(undefined);
  inFlight[key] = true;
  return fn().finally(() => {
    inFlight[key] = false;
  });
}

export async function newProject(): Promise<void> {
  await exclusive("newProject", async () => {
    if (!(await confirmDiscard("Start a new project and discard current changes?")))
      return;
    loadProjectIntoEditor(createDemoProject(), null);
  });
}

export async function openProject(): Promise<void> {
  await exclusive("openProject", async () => {
    if (!(await confirmDiscard("Open another project and discard current changes?")))
      return;
    if (!isTauri()) {
      console.warn("openProject called outside Tauri runtime");
      return;
    }
    let selected: string | string[] | null;
    try {
      selected = await open({ directory: true, multiple: false });
    } catch (e) {
      console.error("dialog.open failed", e);
      await reportRawError(`Couldn't open file picker: ${formatThrown(e)}`);
      return;
    }
    if (typeof selected !== "string") return;
    const result = await openProjectAt(selected);
    if (!result.ok) {
      await reportError(result.error);
      return;
    }
    const renamed = renameProject(result.value, deriveProjectNameFromPath(selected));
    loadProjectIntoEditor(renamed, selected);
  });
}

export async function saveProject(opts: { forceDialog: boolean }): Promise<void> {
  await exclusive("saveProject", () => saveProjectInner(opts));
}

async function saveProjectInner(opts: { forceDialog: boolean }): Promise<void> {
  const project = useSceneStore.getState().project;
  if (!project) return;
  if (!isTauri()) {
    console.warn("saveProject called outside Tauri runtime");
    return;
  }
  const known = useProjectStore.getState().currentPath;
  let targetPath: string | null = known;
  if (opts.forceDialog || !known) {
    try {
      targetPath = await save({
        title: "Save project",
        defaultPath: known ?? `${project.metadata.name}.lowcode`,
      });
    } catch (e) {
      console.error("dialog.save failed", e);
      await reportRawError(`Couldn't open save dialog: ${formatThrown(e)}`);
      return;
    }
  }
  if (typeof targetPath !== "string") return;

  // If we picked (or had) a new path that doesn't match the project's current
  // display name, sync the name to the folder basename BEFORE serialising so
  // the on-disk project.json + the title bar + future re-opens all agree.
  // This also covers the "first save" case where the demo project's stock
  // "Untitled project" gets replaced with whatever the user typed in the
  // save dialog.
  const projectToSave = renameProject(project, deriveProjectNameFromPath(targetPath));
  if (projectToSave !== project) {
    useSceneStore.getState().setProject(projectToSave);
  }

  useProjectStore.getState().setSaving(true);
  try {
    let result = await saveProjectAt(targetPath, projectToSave, false);
    if (
      !result.ok &&
      result.error.kind === "folder" &&
      result.error.error.code === "already_exists_not_empty"
    ) {
      const proceed = await ask(
        `${targetPath} is not empty and isn't a lowcode-3d project. Overwrite?`,
        {
          title: "Overwrite folder",
          kind: "warning",
          okLabel: "Overwrite",
          cancelLabel: "Cancel",
        },
      );
      if (!proceed) return;
      result = await saveProjectAt(targetPath, projectToSave, true);
    }
    if (!result.ok) {
      await reportError(result.error);
      return;
    }
    useProjectStore.getState().setCurrentPath(targetPath);
    useProjectStore.getState().markClean();
  } finally {
    useProjectStore.getState().setSaving(false);
  }
}

/**
 * .glb import flow.
 *
 * Why save-first: assets are content-addressed into `<project>/assets/`, so
 * the project folder must exist on disk before bytes have a home. Rather
 * than introducing an in-memory asset buffer for the unsaved-project case,
 * we ask the user to save first — same pattern Blender/Unity use for
 * "this project hasn't been written yet, pick a path."
 *
 * Why no Command-history entry: import is closer to "Open Project" than
 * "Tweak transform" — a state change the user perceives as committing.
 * Undo for accidental imports is deferred to v2 alongside the explicit
 * Delete Node command (which doesn't exist yet either).
 */
export async function importGlb(): Promise<void> {
  await exclusive("importGlb", importGlbInner);
}

async function importGlbInner(): Promise<void> {
  if (!isTauri()) {
    console.warn("importGlb called outside Tauri runtime");
    return;
  }
  const project = useSceneStore.getState().project;
  if (!project) return;

  let currentPath = useProjectStore.getState().currentPath;
  if (!currentPath) {
    const shouldSave = await ask(
      "Save the project to a folder first — imported assets live next to project.json. Save now?",
      {
        title: "Save project first",
        kind: "info",
        okLabel: "Save…",
        cancelLabel: "Cancel",
      },
    );
    if (!shouldSave) return;
    // saveProject is guarded too, so calling it from inside importGlb's
    // guard is fine — different keys. But heads-up: if you ever change
    // both to share a key, this nested call will silently no-op.
    await saveProject({ forceDialog: true });
    currentPath = useProjectStore.getState().currentPath;
    if (!currentPath) return; // user cancelled the save dialog
  }

  let selected: string | string[] | null;
  try {
    selected = await open({
      multiple: false,
      filters: [{ name: "glTF binary", extensions: ["glb", "gltf"] }],
    });
  } catch (e) {
    console.error("dialog.open(glb) failed", e);
    await reportRawError(`Couldn't open file picker: ${formatThrown(e)}`);
    return;
  }
  if (typeof selected !== "string") return;

  const importResult = await commands.importGlbIntoProject(selected, currentPath);
  if (importResult.status === "error") {
    await reportError({ kind: "folder", error: importResult.error });
    return;
  }
  const imported = importResult.data;

  const asset: AssetReference = {
    id: `asset-${imported.content_hash.slice(0, 12)}`,
    content_hash: imported.content_hash,
    kind: "geometry",
    relative_path: imported.relative_path,
    tags: [],
    description: imported.original_filename,
    source: {
      kind: "user_upload",
      original_filename: imported.original_filename,
    },
  };
  const canonical = useSceneStore.getState().addAsset(asset);

  const nodeName = stemFromFilename(imported.original_filename);
  const newNode: SceneNode = {
    id: generateUUID(),
    name: nodeName,
    type: "prefab_instance",
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "prefab_instance", asset_id: canonical.id },
    behaviors: [],
    user_data: {},
  };
  useSceneStore.getState().addNode(newNode);
  useUIStore.getState().setSelectedNodeId(newNode.id);
  useProjectStore.getState().markDirty();
}

function stemFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name;
  return name.slice(0, dot);
}

export async function closeProject(): Promise<void> {
  await exclusive("closeProject", async () => {
    if (!(await confirmDiscard("Close project and discard current changes?"))) return;
    useSceneStore.getState().setProject(null);
    useUIStore.getState().setSelectedNodeId(null);
    useCommandHistoryStore.getState().clear();
    useProjectStore.getState().reset();
    if (isTauri()) {
      await commands.setCurrentProjectPath(null);
    }
    useAppViewStore.getState().setView("startup");
  });
}

async function confirmDiscard(message: string): Promise<boolean> {
  if (!useProjectStore.getState().isDirty) return true;
  if (!isTauri()) {
    return window.confirm(message);
  }
  return await ask(message, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Discard",
    cancelLabel: "Cancel",
  });
}

function loadProjectIntoEditor(
  project: ReturnType<typeof createDemoProject>,
  path: string | null,
): void {
  useSceneStore.getState().setProject(project);
  useUIStore.getState().setSelectedNodeId(null);
  useCommandHistoryStore.getState().clear();
  useProjectStore.getState().setCurrentPath(path);
  useProjectStore.getState().markClean();
  useAppViewStore.getState().setView("editor");
  if (isTauri()) {
    void commands.setCurrentProjectPath(path);
  }
}

async function reportError(error: ProjectIoError): Promise<void> {
  await reportRawError(formatProjectIoError(error));
}

async function reportRawError(message: string): Promise<void> {
  if (!isTauri()) {
    console.error(message);
    return;
  }
  await ask(message, {
    title: "Project I/O error",
    kind: "error",
    okLabel: "Dismiss",
    cancelLabel: "Dismiss",
  });
}

function formatThrown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
