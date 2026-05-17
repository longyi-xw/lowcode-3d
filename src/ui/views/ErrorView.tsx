import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAppViewStore } from "@/services/app-view/store";

const SAMPLE_SNIPPET = `// at ~/work/showroom-hero/project.json:3
{
  "spec_version": "0.0.7",
  "metadata": { … }
}`;

export function ErrorView() {
  const { t } = useTranslation("errors");
  const setView = useAppViewStore((s) => s.setView);
  const startLoading = useAppViewStore((s) => s.startLoading);

  return (
    <section className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-xl px-6 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60 text-destructive">
          <X className="h-7 w-7" />
        </div>

        <h2 className="text-base font-semibold">{t("project_load.title")}</h2>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {t("project_load.schema_mismatch", { expected: "0.1.0", found: "0.0.7" })}
        </p>

        <pre className="mt-5 overflow-x-auto rounded-md border border-border bg-card p-3 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
          {SAMPLE_SNIPPET}
        </pre>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled
            title={t("project_load.migration_not_implemented")}
            className="cursor-not-allowed rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground opacity-60"
          >
            {t("project_load.run_migration")}
          </button>
          <button
            type="button"
            onClick={() => startLoading("editor")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {t("project_load.try_again")}
          </button>
        </div>

        <p className="mt-8">
          <button
            type="button"
            onClick={() => setView("startup")}
            className="font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← {t("back_to_startup")}
          </button>
        </p>

        <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
          {t("project_load.report_issue")}
        </p>
      </div>
    </section>
  );
}
