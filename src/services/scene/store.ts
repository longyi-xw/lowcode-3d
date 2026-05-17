import { create } from "zustand";

/**
 * Scene store — placeholder.
 *
 * Will hold the live `SceneProject` (see design/framework/architecture.md §3)
 * once the Scene Graph types land. For now exposes a stub `projectId` so the
 * rest of the app can check "is anything loaded" without crashing.
 */
interface SceneState {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  projectId: null,
  setProjectId: (projectId) => set({ projectId }),
}));
