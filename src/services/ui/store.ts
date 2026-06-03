import { create } from "zustand";

/**
 * UI store — ephemeral, never persisted.
 *
 * Holds session-only UI state: which panels are open, which dialogs are
 * visible, which node is selected for inspection, which nodes are expanded
 * in the hierarchy tree. Reset on every launch.
 */
export type GizmoMode = "translate" | "rotate" | "scale";
export type RightPanelTab = "properties" | "behaviors";
export type PlayState = "edit" | "play";

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
  /** Which TransformControls mode the viewport gizmo is in. */
  gizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  /** Right-aside tab — properties (default) or behaviors. */
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  /** edit = author mode (commands enabled); play = behaviors run, mutations
   *  via undo/redo / commands are swallowed by command-history. */
  playState: PlayState;
  setPlayState: (state: PlayState) => void;
  /** Whether the keyboard-shortcuts help dialog is visible. */
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  /** Whether the New-project template picker dialog is visible. */
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  /** Whether the bottom asset-library drawer is expanded. Toggled by Cmd/Ctrl+J
   *  and the drawer's chevron. Starts collapsed. */
  libraryOpen: boolean;
  setLibraryOpen: (open: boolean) => void;
  /**
   * 3-state focus request channel:
   *   undefined  → no request pending
   *   null       → focus the scene origin (no selection at request time)
   *   string     → focus the node with this id
   *
   * ThreeViewport watches this field and calls consumeFocusRequest()
   * after applying the focus.
   */
  pendingFocusNodeId: string | null | undefined;
  requestFocus: (nodeId: string | null) => void;
  consumeFocusRequest: () => void;
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
  gizmoMode: "translate",
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  rightPanelTab: "properties",
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  playState: "edit",
  setPlayState: (playState) => set({ playState }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  newProjectOpen: false,
  setNewProjectOpen: (newProjectOpen) => set({ newProjectOpen }),
  libraryOpen: false,
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  pendingFocusNodeId: undefined,
  requestFocus: (pendingFocusNodeId) => set({ pendingFocusNodeId }),
  consumeFocusRequest: () => set({ pendingFocusNodeId: undefined }),
}));
