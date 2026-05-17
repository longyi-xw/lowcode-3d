import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SupportedLanguage } from "@/i18n/config";

export type Theme = "light" | "dark" | "system";
export type AccentColor = "blue" | "green" | "orange" | "purple" | "yellow";
export type UIDensity = "compact" | "cozy" | "comfortable";

export const THEMES: readonly Theme[] = ["light", "dark", "system"];
export const ACCENT_COLORS: readonly AccentColor[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "yellow",
];
export const UI_DENSITIES: readonly UIDensity[] = [
  "compact",
  "cozy",
  "comfortable",
];

interface SettingsState {
  /** null means "follow detected language from i18n detector / OS locale". */
  language: SupportedLanguage | null;
  theme: Theme;
  accent: AccentColor;
  density: UIDensity;
  setLanguage: (language: SupportedLanguage) => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: AccentColor) => void;
  setDensity: (density: UIDensity) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      theme: "system",
      accent: "blue",
      density: "cozy",
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setDensity: (density) => set({ density }),
    }),
    {
      name: "lowcode3d.settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
