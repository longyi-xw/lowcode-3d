import { create } from "zustand";

import type { Command, SceneEditorStore } from "@/core/command/types";
import { useUIStore } from "@/services/ui/store";

/**
 * Undo/redo history backed by the Phase 0 Command bus.
 *
 * Each call to `execute` applies the command, then either merges it with the
 * top of the undo stack (if `canMergeWith` returns true) or pushes a new entry.
 * The redo stack is cleared on every `execute` because making a new edit
 * invalidates anything previously undone.
 *
 * The stack is capped at `MAX_HISTORY` entries to keep memory bounded during
 * long sessions; merging means a continuous drag never counts against the cap.
 */
const MAX_HISTORY = 200;

interface CommandHistoryState {
  undoStack: Command[];
  redoStack: Command[];
  execute: (command: Command, editor: SceneEditorStore) => void;
  undo: (editor: SceneEditorStore) => void;
  redo: (editor: SceneEditorStore) => void;
  clear: () => void;
}

export const useCommandHistoryStore = create<CommandHistoryState>((set) => ({
  undoStack: [],
  redoStack: [],

  execute: (command, editor) => {
    if (useUIStore.getState().playState === "play") return;
    command.apply(editor);
    set((s) => {
      const top = s.undoStack[s.undoStack.length - 1];
      let nextUndoStack: Command[];
      if (top && top.canMergeWith(command)) {
        nextUndoStack = [...s.undoStack.slice(0, -1), top.mergeWith(command)];
      } else {
        nextUndoStack = [...s.undoStack, command];
      }
      if (nextUndoStack.length > MAX_HISTORY) {
        nextUndoStack = nextUndoStack.slice(nextUndoStack.length - MAX_HISTORY);
      }
      return { undoStack: nextUndoStack, redoStack: [] };
    });
  },

  undo: (editor) => {
    if (useUIStore.getState().playState === "play") return;
    set((s) => {
      const command = s.undoStack[s.undoStack.length - 1];
      if (!command) return s;
      command.revert(editor);
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, command],
      };
    });
  },

  redo: (editor) => {
    if (useUIStore.getState().playState === "play") return;
    set((s) => {
      const command = s.redoStack[s.redoStack.length - 1];
      if (!command) return s;
      command.apply(editor);
      return {
        undoStack: [...s.undoStack, command],
        redoStack: s.redoStack.slice(0, -1),
      };
    });
  },

  clear: () => set({ undoStack: [], redoStack: [] }),
}));
