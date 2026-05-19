import { create } from "zustand";

import type { SceneNode, SceneProject, Transform } from "@/core/scene/types";
import type { SceneEditorStore } from "@/core/command/types";

/**
 * Scene store — holds the live SceneProject the editor is operating on.
 *
 * Mutators always replace `project` with a structurally-new object (and a new
 * `scene.nodes` map, and a new SceneNode for the changed id) so React + zustand
 * subscribers can diff by identity. `updated_at` is bumped on every mutation.
 */
interface SceneState {
  project: SceneProject | null;
  setProject: (project: SceneProject | null) => void;
  /** Read a SceneNode by id, or undefined when there is no live project / no
   *  such node. Implements the `getNode` half of {@link SceneEditorStore}. */
  getNode: (id: string) => SceneNode | undefined;
  /** Replace a single node's transform. Mutates project / scene / node by
   *  identity so observers can diff. Implements the `setNodeTransform` half
   *  of {@link SceneEditorStore}. */
  setNodeTransform: (id: string, transform: Transform) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  project: null,
  setProject: (project) => set({ project }),
  getNode: (id) => get().project?.scene.nodes[id],
  setNodeTransform: (id, transform) =>
    set((s) => {
      if (!s.project) return s;
      const node = s.project.scene.nodes[id];
      if (!node) return s;
      const nextNode: SceneNode = { ...node, transform };
      return {
        project: {
          ...s.project,
          metadata: {
            ...s.project.metadata,
            updated_at: new Date().toISOString(),
          },
          scene: {
            ...s.project.scene,
            nodes: { ...s.project.scene.nodes, [id]: nextNode },
          },
        },
      };
    }),
}));

/**
 * Adapter that exposes `useSceneStore`'s current state as the narrow
 * {@link SceneEditorStore} interface Commands consume. Re-reads the latest
 * state on every call so the editor sees the freshest values even mid-merge.
 */
export function getSceneEditorStore(): SceneEditorStore {
  return {
    getNode: (id) => useSceneStore.getState().getNode(id),
    setNodeTransform: (id, transform) =>
      useSceneStore.getState().setNodeTransform(id, transform),
  };
}
