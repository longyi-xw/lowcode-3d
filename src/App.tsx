import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./i18n/config";

function App() {
  const { t, i18n } = useTranslation(["common", "settings"]);

  const onChangeLanguage = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">
          {t("common:app.name")}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {t("common:app.scaffold_status")}
        </p>
        <p className="mt-6 text-sm leading-relaxed">{t("common:app.tagline")}</p>

        <div className="mt-10 flex items-center gap-3">
          <label className="text-sm font-medium">
            {t("settings:language.label")}:
          </label>
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => onChangeLanguage(lng)}
              className={
                "rounded-md border px-3 py-1.5 text-sm transition " +
                (i18n.resolvedLanguage === lng
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted")
              }
            >
              {t(`settings:language.options.${lng}` as const)}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

export default App;
