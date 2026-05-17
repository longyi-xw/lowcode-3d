import { create } from "zustand";

export const APP_VIEWS = ["startup", "loading", "editor", "error"] as const;
export type AppView = (typeof APP_VIEWS)[number];

export type LoadingTarget = Extract<AppView, "editor" | "error">;

interface AppViewState {
  view: AppView;
  /**
   * Where LoadingView should transition to when its steps complete.
   * Only meaningful while view === "loading".
   */
  loadingTarget: LoadingTarget;
  setView: (view: AppView) => void;
  /**
   * Switch to the loading view and record where to go after the steps finish.
   * Defaults to "editor"; pass "error" to simulate a failing load.
   */
  startLoading: (target?: LoadingTarget) => void;
}

export const useAppViewStore = create<AppViewState>((set) => ({
  view: "startup",
  loadingTarget: "editor",
  setView: (view) => set({ view }),
  startLoading: (target = "editor") => set({ view: "loading", loadingTarget: target }),
}));
