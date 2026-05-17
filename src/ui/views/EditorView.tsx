import { useTranslation } from "react-i18next";

export function EditorView() {
  const { t } = useTranslation("common");
  return (
    <section className="grid min-h-screen grid-cols-[240px_1fr_320px] bg-background text-foreground">
      <aside className="border-r border-border p-4">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          hierarchy
        </p>
      </aside>
      <main className="flex items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">
          {t("views.editor")}
        </p>
      </main>
      <aside className="border-l border-border p-4">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          properties
        </p>
      </aside>
    </section>
  );
}
