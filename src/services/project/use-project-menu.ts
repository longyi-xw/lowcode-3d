import { useEffect } from "react";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

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

type MenuId = "file:new" | "file:open" | "file:save" | "file:save_as" | "file:close";

/**
 * Top-level effect that wires the native File menu (PR B2) into save / open /
 * new / close flows. Mounted from App.tsx so it survives view transitions.
 *
 * Save flow:
 *   - file:save with a known path → write to that path
 *   - file:save with no path → fall through to file:save_as
 *   - file:save_as → directory picker, write, mirror path into Rust state
 *
 * Open flow:
 *   - prompt before discarding unsaved work
 *   - directory picker, read, load into scene store, switch to editor view
 *
 * New / Close:
 *   - same dirty-check prompt
 *   - New seeds a fresh demo project; Close clears state and returns to
 *     StartupView
 */
export function useProjectMenu(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let cleanup: (() => void) | undefined;

    void getCurrentWindow()
      .listen<string>("menu", (event) => {
        void dispatchMenu(event.payload as MenuId);
      })
      .then((unlisten) => {
        cleanup = unlisten;
      });

    return () => {
      cleanup?.();
    };
  }, []);
}

async function dispatchMenu(id: MenuId): Promise<void> {
  switch (id) {
    case "file:new":
      await handleNew();
      return;
    case "file:open":
      await handleOpen();
      return;
    case "file:save":
      await handleSave({ forceDialog: false });
      return;
    case "file:save_as":
      await handleSave({ forceDialog: true });
      return;
    case "file:close":
      await handleClose();
      return;
  }
}

async function confirmDiscard(message: string): Promise<boolean> {
  if (!useProjectStore.getState().isDirty) return true;
  const proceed = await ask(message, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Discard",
    cancelLabel: "Cancel",
  });
  return proceed;
}

async function handleNew(): Promise<void> {
  if (!(await confirmDiscard("Start a new project and discard current changes?")))
    return;
  loadProjectIntoEditor(createDemoProject(), null);
}

async function handleOpen(): Promise<void> {
  if (!(await confirmDiscard("Open another project and discard current changes?")))
    return;
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") return;
  const result = await openProjectAt(selected);
  if (!result.ok) {
    await reportError(result.error);
    return;
  }
  loadProjectIntoEditor(result.value, selected);
}

async function handleSave(opts: { forceDialog: boolean }): Promise<void> {
  const project = useSceneStore.getState().project;
  if (!project) return;
  const known = useProjectStore.getState().currentPath;
  const targetPath =
    opts.forceDialog || !known
      ? await save({
          title: "Save project",
          defaultPath: known ?? `${project.metadata.name}.lowcode`,
        })
      : known;
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

async function handleClose(): Promise<void> {
  if (!(await confirmDiscard("Close project and discard current changes?"))) return;
  useSceneStore.getState().setProject(null);
  useUIStore.getState().setSelectedNodeId(null);
  useCommandHistoryStore.getState().clear();
  useProjectStore.getState().reset();
  await commands.setCurrentProjectPath(null);
  useAppViewStore.getState().setView("startup");
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
  void commands.setCurrentProjectPath(path);
}

async function reportError(error: ProjectIoError): Promise<void> {
  await ask(formatProjectIoError(error), {
    title: "Project I/O error",
    kind: "error",
    okLabel: "Dismiss",
    cancelLabel: "Dismiss",
  });
}
