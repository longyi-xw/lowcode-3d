import { useTranslation } from "react-i18next";
import { APP_VIEWS, useAppViewStore } from "@/services/app-view/store";
import { cn } from "@/lib/utils";

export function DemoViewBar() {
  const { t } = useTranslation("common");
  const { view, setView } = useAppViewStore();

  return (
    <div
      role="toolbar"
      aria-label="demo views"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover/90 px-2 py-1.5 text-xs shadow-lg backdrop-blur-sm"
    >
      <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        demo views
      </span>
      {APP_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={cn(
            "rounded-full px-3 py-1 transition",
            view === v
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-muted",
          )}
        >
          {t(`views.${v}`)}
        </button>
      ))}
    </div>
  );
}
