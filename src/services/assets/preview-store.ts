import { create } from "zustand";

/**
 * Lightweight preview of an imported asset's internal structure.
 *
 * Used by the hierarchy panel to show what's inside a prefab_instance when
 * the user expands it — names + nesting only, no transforms or geometry.
 * The authoritative bytes live in the cached `THREE.Group` template (held
 * by `AssetCache`); this store is a UI-friendly mirror populated *after*
 * the template loads so React components can render without reaching into
 * the runtime adapter.
 */
export interface PrefabPreviewNode {
  /** Best-effort name pulled from the glTF `name` field. Falls back to a
   *  numeric placeholder when the source file leaves names blank. */
  name: string;
  /** Three.js object class — narrowed to the kinds the hierarchy panel
   *  decorates differently. Anything we don't visit specifically is "other"
   *  (lights, helpers, etc.) so the renderer can show a neutral icon. */
  kind: "group" | "mesh" | "other";
  children: PrefabPreviewNode[];
}

interface AssetPreviewState {
  trees: Record<string, PrefabPreviewNode>;
  setTree: (assetId: string, tree: PrefabPreviewNode) => void;
  clear: () => void;
}

export const useAssetPreviewStore = create<AssetPreviewState>((set) => ({
  trees: {},
  setTree: (assetId, tree) => set((s) => ({ trees: { ...s.trees, [assetId]: tree } })),
  clear: () => set({ trees: {} }),
}));
