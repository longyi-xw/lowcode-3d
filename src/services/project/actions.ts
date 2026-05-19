import { ask, open, save } from "@tauri-apps/plugin-dialog";

import { commands } from "@/bindings/tauri";
import { isTauri } from "@/lib/runtime";
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
 * Project-level actions shared between three callers: StartupView buttons,
 * EditorView's close button, and the native File menu. Centralising the dirty
 * check + dialog + error toast here means the three entry points stay in
 * lockstep.
 */

export async function newProject(): Promise<void> {
  if (!(await confirmDiscard("Start a new project and discard current changes?")))
    return;
  loadProjectIntoEditor(createDemoProject(), null);
}

export async function openProject(): Promise<void> {
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
  loadProjectIntoEditor(result.value, selected);
}

export async function saveProject(opts: { forceDialog: boolean }): Promise<void> {
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

  useProjectStore.getState().setSaving(true);
  try {
    let result = await saveProjectAt(targetPath, project, false);
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
      result = await saveProjectAt(targetPath, project, true);
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

export async function closeProject(): Promise<void> {
  if (!(await confirmDiscard("Close project and discard current changes?"))) return;
  useSceneStore.getState().setProject(null);
  useUIStore.getState().setSelectedNodeId(null);
  useCommandHistoryStore.getState().clear();
  useProjectStore.getState().reset();
  if (isTauri()) {
    await commands.setCurrentProjectPath(null);
  }
  useAppViewStore.getState().setView("startup");
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
