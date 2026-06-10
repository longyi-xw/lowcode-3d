import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { ViewportEngine } from "@/runtime/render-host";
import { useUIStore } from "@/services/ui/store";

const ENGINES: { engine: ViewportEngine; labelKey: string }[] = [
  { engine: "three.js", labelKey: "viewport.engine.three" },
  { engine: "babylon.js", labelKey: "viewport.engine.babylon" },
];

/**
 * Three/Babylon viewport engine switch (v1.0 B1). Switching forces playState
 * back to "edit" first: the Three viewport tears down play mode on unmount,
 * but the store flag would otherwise stay "play" with nothing ticking —
 * and remounting ThreeViewport while playState === "play" would show a
 * paused-looking play mode with no behaviors installed.
 */
export function EngineToggle() {
  const { t } = useTranslation("editor");
  const engine = useUIStore((s) => s.viewportEngine);
  const setViewportEngine = useUIStore((s) => s.setViewportEngine);
  const setPlayState = useUIStore((s) => s.setPlayState);

  return (
    <div
      title={t("viewport.engine.title")}
      className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-border bg-popover/90 px-1.5 py-1 text-[11px] shadow-lg backdrop-blur-sm"
    >
      {ENGINES.map((entry) => {
        const active = entry.engine === engine;
        return (
          <button
            key={entry.engine}
            type="button"
            onClick={() => {
              if (active) return;
              setPlayState("edit");
              setViewportEngine(entry.engine);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            {t(entry.labelKey, { defaultValue: entry.labelKey })}
          </button>
        );
      })}
    </div>
  );
}
