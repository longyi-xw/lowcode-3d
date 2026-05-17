import { create } from "zustand";

export const APP_VIEWS = ["startup", "loading", "editor", "error"] as const;
export type AppView = (typeof APP_VIEWS)[number];

interface AppViewState {
  view: AppView;
  setView: (view: AppView) => void;
}

export const useAppViewStore = create<AppViewState>((set) => ({
  view: "startup",
  setView: (view) => set({ view }),
}));
