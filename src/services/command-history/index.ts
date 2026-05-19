import type { Command } from "@/core/command/types";
import { getSceneEditorStore } from "@/services/scene/store";

import { useCommandHistoryStore } from "./store";

export { useCommandHistoryStore } from "./store";

/**
 * Imperative helpers that bind the command-history store to the live scene
 * editor. UI code calls these directly; keyboard shortcut handlers and command
 * palette entries do too.
 */

export function executeCommand(command: Command): void {
  useCommandHistoryStore.getState().execute(command, getSceneEditorStore());
}

export function undo(): void {
  useCommandHistoryStore.getState().undo(getSceneEditorStore());
}

export function redo(): void {
  useCommandHistoryStore.getState().redo(getSceneEditorStore());
}

export function canUndo(): boolean {
  return useCommandHistoryStore.getState().undoStack.length > 0;
}

export function canRedo(): boolean {
  return useCommandHistoryStore.getState().redoStack.length > 0;
}
