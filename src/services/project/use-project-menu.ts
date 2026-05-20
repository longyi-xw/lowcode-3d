import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "@/lib/runtime";

import {
  closeProject,
  importGlb,
  newProject,
  openProject,
  saveProject,
} from "./actions";

type MenuId =
  | "file:new"
  | "file:open"
  | "file:save"
  | "file:save_as"
  | "file:import_glb"
  | "file:close";

/**
 * Top-level effect that wires the native File menu (PR B2) into the project
 * actions. Mounted from App.tsx so it survives view transitions.
 *
 * All real work lives in `./actions`. This hook only translates `MenuId`
 * payloads into action calls so the same actions can be triggered from
 * non-menu surfaces (StartupView buttons, EditorView close button).
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
      await newProject();
      return;
    case "file:open":
      await openProject();
      return;
    case "file:save":
      await saveProject({ forceDialog: false });
      return;
    case "file:save_as":
      await saveProject({ forceDialog: true });
      return;
    case "file:import_glb":
      await importGlb();
      return;
    case "file:close":
      await closeProject();
      return;
  }
}
