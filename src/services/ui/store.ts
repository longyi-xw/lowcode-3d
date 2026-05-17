import { create } from "zustand";

/**
 * UI store — ephemeral, never persisted.
 *
 * Holds session-only UI state: which panels are open, which dialogs are
 * visible, which node is selected for inspection, etc. Reset on every launch.
 */
interface UIState {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  hierarchyCollapsed: boolean;
  setHierarchyCollapsed: (collapsed: boolean) => void;
  propertiesCollapsed: boolean;
  setPropertiesCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  hierarchyCollapsed: false,
  setHierarchyCollapsed: (hierarchyCollapsed) => set({ hierarchyCollapsed }),
  propertiesCollapsed: false,
  setPropertiesCollapsed: (propertiesCollapsed) => set({ propertiesCollapsed }),
}));
