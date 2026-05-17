import { useTranslation } from "react-i18next";

export function ErrorView() {
  const { t } = useTranslation("common");
  return (
    <section className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/60 text-destructive">
          <span className="text-xl">!</span>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {t("views.error")}
        </p>
      </div>
    </section>
  );
}
