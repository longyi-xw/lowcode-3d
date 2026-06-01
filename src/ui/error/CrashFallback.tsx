import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

export function CrashFallback({ error }: { error: Error | null }) {
  const { t } = useTranslation("errors");
  const detail = error?.stack ?? error?.message ?? "";
  return (
    <section className="flex h-screen w-screen items-center justify-center overflow-auto bg-background text-foreground">
      <div className="w-full max-w-xl px-6 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-base font-semibold">{t("crash.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("crash.message_hint")}</p>
        {error?.message && (
          <pre className="mt-5 max-h-48 overflow-auto rounded-md border border-border bg-card p-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {t("crash.reload")}
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(detail)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {t("crash.copy")}
          </button>
        </div>
      </div>
    </section>
  );
}
