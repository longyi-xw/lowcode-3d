import { useEffect } from "react";

import { redo, undo } from "./index";

/**
 * Global keyboard-shortcut hook for undo / redo:
 *   - Cmd+Z  / Ctrl+Z       → undo
 *   - Cmd+Shift+Z / Ctrl+Shift+Z → redo
 *   - Ctrl+Y (Windows alternate)  → redo
 *
 * Skipped when the keystroke originates in a text input or contenteditable,
 * so the browser's native undo for typed text still works.
 */
export function useCommandHistoryShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
