import { create } from "zustand";
import type { SceneProject } from "@/core/scene/types";

/**
 * Scene store — holds the live SceneProject the editor is operating on.
 *
 * For Phase 1 we keep this minimal: the project is either loaded or null.
 * Per-node mutators that the Command system will drive live in a follow-up;
 * the viewport currently re-syncs the entire tree on project replacement.
 */
interface SceneState {
  project: SceneProject | null;
  setProject: (project: SceneProject | null) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
}));
