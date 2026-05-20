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
 *
 * The cancel-flag dance below matters: `listen` returns a promise, and in
 * React 18 strict mode the effect mounts → unmounts → re-mounts before the
 * first `listen` resolves. Without the flag, the cleanup fires while
 * `unlisten` is still undefined, leaks the in-flight subscription, and the
 * remount adds a second one — every menu click then fires two `importGlb`
 * (or any other action), surfacing as duplicate "Save first" dialogs.
 */
export function useProjectMenu(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .listen<string>("menu", (event) => {
        if (cancelled) return;
        void dispatchMenu(event.payload as MenuId);
      })
      .then((u) => {
        if (cancelled) {
          u();
        } else {
          unlisten = u;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
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
