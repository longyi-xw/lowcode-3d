import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type Theme } from "./store";

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Applies useSettingsStore values to the <html> element and keeps i18n
 * in sync with the persisted language preference. Mount once near the
 * root of the React tree.
 */
export function AppSettingsEffects() {
  const { i18n } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const accent = useSettingsStore((s) => s.accent);
  const density = useSettingsStore((s) => s.density);

  // Theme: data-theme + .dark class on <html>; track system pref when in "system".
  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    root.dataset.theme = resolved;
    root.classList.toggle("dark", resolved === "dark");

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = mq.matches ? "dark" : "light";
      root.dataset.theme = r;
      root.classList.toggle("dark", r === "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  // Language: if user chose explicitly, force i18n to match.
  useEffect(() => {
    if (language && i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Keep <html lang> in sync with whatever i18n resolves to.
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.lang = lng;
    };
    apply(i18n.resolvedLanguage ?? "en");
    i18n.on("languageChanged", apply);
    return () => {
      i18n.off("languageChanged", apply);
    };
  }, [i18n]);

  return null;
}
