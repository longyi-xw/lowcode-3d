import { useTranslation } from "react-i18next";
import { Box, X } from "lucide-react";
import { useAppViewStore } from "@/services/app-view/store";

export function EditorView() {
  const { t } = useTranslation(["common", "editor"]);
  const setView = useAppViewStore((s) => s.setView);

  return (
    <section className="grid min-h-screen grid-cols-[240px_1fr_320px] bg-background text-foreground">
      <aside className="flex flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Box className="h-3.5 w-3.5 text-primary" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("editor:hierarchy.title")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView("startup")}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("editor:close_project")}
          >
            <X className="h-3 w-3" />
            <span>{t("editor:close_project")}</span>
          </button>
        </div>
        <div className="flex-1 p-3 text-xs text-muted-foreground">
          {t("editor:hierarchy.empty")}
        </div>
      </aside>

      <main className="relative flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-muted-foreground">
            {t("editor:viewport.empty")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("editor:viewport.empty_hint")}
          </p>
        </div>
      </main>

      <aside className="border-l border-border">
        <div className="border-b border-border px-3 py-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("editor:properties.title")}
          </p>
        </div>
        <div className="p-3 text-xs text-muted-foreground">
          {t("editor:properties.empty")}
        </div>
      </aside>
    </section>
  );
}
