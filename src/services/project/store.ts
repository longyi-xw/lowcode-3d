import { create } from "zustand";

/**
 * Project-level UI state: where the open project lives on disk, and whether
 * any edits since the last save are still in memory.
 *
 * Why this is split from `useSceneStore`: SceneStore mutates on every property
 * edit and gizmo drag (hundreds of times per minute). currentPath / isDirty
 * change at a totally different cadence — at save/open/close boundaries. Two
 * stores means a header subscribing to `isDirty` doesn't re-render on every
 * transform tweak.
 *
 * The Rust side owns the authoritative `current_project_path` (so save knows
 * where to write without an argument). `setCurrentPath` mirrors changes into
 * Rust state via the typed binding.
 */
interface ProjectState {
  currentPath: string | null;
  isDirty: boolean;
  isSaving: boolean;
  setCurrentPath: (path: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentPath: null,
  isDirty: false,
  isSaving: false,
  setCurrentPath: (currentPath) => set({ currentPath }),
  markDirty: () => set((s) => (s.isDirty ? s : { isDirty: true })),
  markClean: () => set((s) => (s.isDirty ? { isDirty: false } : s)),
  setSaving: (isSaving) => set({ isSaving }),
  reset: () => set({ currentPath: null, isDirty: false, isSaving: false }),
}));
