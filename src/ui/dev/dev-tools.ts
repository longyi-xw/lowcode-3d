import {
  useAppViewStore,
  type AppView,
  type LoadingTarget,
} from "@/services/app-view/store";
import {
  useSettingsStore,
  type AccentColor,
  type Theme,
  type UIDensity,
} from "@/services/settings/store";

// Dev-only console helpers. Wrapped so the entire body is dead-code-eliminated
// from production bundles by Vite.
if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.__setView = (v: AppView) => useAppViewStore.getState().setView(v);
  w.__getView = () => useAppViewStore.getState().view;
  w.__startLoading = (target?: LoadingTarget) =>
    useAppViewStore.getState().startLoading(target);
  w.__setTheme = (t: Theme) => useSettingsStore.getState().setTheme(t);
  w.__setAccent = (a: AccentColor) => useSettingsStore.getState().setAccent(a);
  w.__setDensity = (d: UIDensity) => useSettingsStore.getState().setDensity(d);
  console.info(
    "%c[lowcode-3d dev]%c window helpers ready:\n" +
      "  __setView('startup'|'loading'|'editor'|'error')\n" +
      "  __getView()\n" +
      "  __startLoading('editor'|'error')\n" +
      "  __setTheme('light'|'dark'|'system')\n" +
      "  __setAccent('blue'|'green'|'orange'|'purple'|'yellow')\n" +
      "  __setDensity('compact'|'cozy'|'comfortable')",
    "color:hsl(217 91% 60%);font-weight:bold",
    "color:inherit",
  );
}

export {};
