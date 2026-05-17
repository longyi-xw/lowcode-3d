import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function StartupView() {
  const { t, i18n } = useTranslation(["common", "settings"]);

  const changeLanguage = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
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

        <div className="mt-12 flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">
            {t("settings:language.label")}:
          </span>
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => changeLanguage(lng)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition",
                i18n.resolvedLanguage === lng
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {t(`settings:language.options.${lng}` as const)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
