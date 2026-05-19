import { create } from "zustand";

/**
 * UI store — ephemeral, never persisted.
 *
 * Holds session-only UI state: which panels are open, which dialogs are
 * visible, which node is selected for inspection, which nodes are expanded
 * in the hierarchy tree. Reset on every launch.
 */
interface UIState {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  hierarchyCollapsed: boolean;
  setHierarchyCollapsed: (collapsed: boolean) => void;
  propertiesCollapsed: boolean;
  setPropertiesCollapsed: (collapsed: boolean) => void;
  /** SceneNode.id under user inspection. null when nothing is selected. */
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  /** Per-node expanded flag in the hierarchy tree. Missing == collapsed. */
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (nodeId: string) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  hierarchyCollapsed: false,
  setHierarchyCollapsed: (hierarchyCollapsed) => set({ hierarchyCollapsed }),
  propertiesCollapsed: false,
  setPropertiesCollapsed: (propertiesCollapsed) => set({ propertiesCollapsed }),
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  expandedNodes: {},
  toggleNodeExpanded: (nodeId) =>
    set((s) => ({
      expandedNodes: {
        ...s.expandedNodes,
        [nodeId]: !s.expandedNodes[nodeId],
      },
    })),
  setNodeExpanded: (nodeId, expanded) =>
    set((s) => ({
      expandedNodes: { ...s.expandedNodes, [nodeId]: expanded },
    })),
}));
