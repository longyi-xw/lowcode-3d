import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n/config";
import {
  ACCENT_COLORS,
  THEMES,
  UI_DENSITIES,
  useSettingsStore,
} from "@/services/settings/store";
import { cn } from "@/lib/utils";

export function StartupView() {
  const { t, i18n } = useTranslation(["common", "settings"]);
  const {
    setLanguage,
    theme,
    setTheme,
    accent,
    setAccent,
    density,
    setDensity,
  } = useSettingsStore();

  const changeLanguage = (lng: SupportedLanguage) => {
    setLanguage(lng);
  };

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-2xl px-6 text-center">
        <h1 className="font-sans text-5xl font-semibold tracking-tight">
          {t("common:app.name")}
        </h1>
        <p className="mt-3 font-mono text-sm text-muted-foreground">
          {t("common:app.scaffold_status")}
        </p>
        <p className="mt-8 text-sm leading-relaxed text-foreground/80">
          {t("common:app.tagline")}
        </p>

        <div className="mt-12 space-y-4">
          <Row label={t("settings:language.label")}>
            {SUPPORTED_LANGUAGES.map((lng) => (
              <Pill
                key={lng}
                active={i18n.resolvedLanguage === lng}
                onClick={() => changeLanguage(lng)}
              >
                {t(`settings:language.options.${lng}` as const)}
              </Pill>
            ))}
          </Row>

          <Row label="theme">
            {THEMES.map((th) => (
              <Pill key={th} active={theme === th} onClick={() => setTheme(th)}>
                {th}
              </Pill>
            ))}
          </Row>

          <Row label="accent">
            {ACCENT_COLORS.map((ac) => (
              <Pill
                key={ac}
                active={accent === ac}
                onClick={() => setAccent(ac)}
              >
                {ac}
              </Pill>
            ))}
          </Row>

          <Row label="density">
            {UI_DENSITIES.map((d) => (
              <Pill key={d} active={density === d} onClick={() => setDensity(d)}>
                {d}
              </Pill>
            ))}
          </Row>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="w-20 text-right text-sm text-muted-foreground">
        {label}:
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm capitalize transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
