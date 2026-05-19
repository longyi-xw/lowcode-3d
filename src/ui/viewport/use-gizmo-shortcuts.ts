import { useEffect } from "react";

import { useUIStore } from "@/services/ui/store";

/**
 * Blender-style gizmo-mode keybindings:
 *   - G → translate
 *   - R → rotate
 *   - S → scale
 *
 * Skipped when focus is in an input / textarea / contenteditable, and
 * skipped when any modifier key is held (so ⌘S / Ctrl+S / etc. stay free
 * for future global shortcuts).
 */
export function useGizmoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      const key = e.key.toLowerCase();
      const setMode = useUIStore.getState().setGizmoMode;
      if (key === "g") {
        e.preventDefault();
        setMode("translate");
      } else if (key === "r") {
        e.preventDefault();
        setMode("rotate");
      } else if (key === "s") {
        e.preventDefault();
        setMode("scale");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
