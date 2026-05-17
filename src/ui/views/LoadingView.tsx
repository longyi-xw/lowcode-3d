import { useTranslation } from "react-i18next";

export function LoadingView() {
  const { t } = useTranslation("common");
  return (
    <section className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="font-mono text-sm text-muted-foreground">
          {t("views.loading")}
        </p>
      </div>
    </section>
  );
}
