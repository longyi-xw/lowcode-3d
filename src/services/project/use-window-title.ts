import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "@/lib/runtime";
import { useSceneStore } from "@/services/scene/store";

import { useProjectStore } from "./store";

/**
 * Mirrors `project name (• if dirty) — lowcode-3d` into the OS window title so
 * the desktop / dock / app switcher reflect the document state. macOS dirty
 * convention is a filled dot in the close button; we use "•" in the title
 * for portable convention across the three OSes.
 */
export function useWindowTitle(): void {
  const projectName = useSceneStore((s) => s.project?.metadata.name ?? null);
  const isDirty = useProjectStore((s) => s.isDirty);

  useEffect(() => {
    if (!isTauri()) return;
    const base = "lowcode-3d";
    const title = projectName ? `${projectName}${isDirty ? " •" : ""} — ${base}` : base;
    void getCurrentWindow().setTitle(title);
  }, [projectName, isDirty]);
}
