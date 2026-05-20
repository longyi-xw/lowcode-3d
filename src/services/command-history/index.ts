import type { Command } from "@/core/command/types";
import { useProjectStore } from "@/services/project/store";
import { getSceneEditorStore } from "@/services/scene/store";

import { useCommandHistoryStore } from "./store";

export { useCommandHistoryStore } from "./store";

/**
 * Imperative helpers that bind the command-history store to the live scene
 * editor. UI code calls these directly; keyboard shortcut handlers and command
 * palette entries do too.
 *
 * Every mutation also marks the project dirty so the title-bar asterisk and
 * the "discard changes?" prompts on Open/New stay accurate. Undo/redo dirty
 * because they too move the in-memory state away from the on-disk version —
 * even when redo lands you back on the same content, we don't track content
 * hashes (yet), and conservatively-dirty is the safe default.
 */

export function executeCommand(command: Command): void {
  useCommandHistoryStore.getState().execute(command, getSceneEditorStore());
  useProjectStore.getState().markDirty();
}

export function undo(): void {
  useCommandHistoryStore.getState().undo(getSceneEditorStore());
  useProjectStore.getState().markDirty();
}

export function redo(): void {
  useCommandHistoryStore.getState().redo(getSceneEditorStore());
  useProjectStore.getState().markDirty();
}

export function canUndo(): boolean {
  return useCommandHistoryStore.getState().undoStack.length > 0;
}

export function canRedo(): boolean {
  return useCommandHistoryStore.getState().redoStack.length > 0;
}
