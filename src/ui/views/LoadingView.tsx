import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Loader2 } from "lucide-react";
import { useAppViewStore } from "@/services/app-view/store";
import { cn } from "@/lib/utils";

const STEP_KEYS = [
  "parsing",
  "resolving",
  "verifying",
  "loading_asset",
  "booting_adapter",
  "warming_webgl",
] as const;

const STEP_INTERVAL_MS = 450;

// Placeholder project name shown while real project loading isn't wired yet.
// Will be replaced by the actual project from useSceneStore in Phase 2.
const DEMO_PROJECT_NAME = "showroom-hero";

export function LoadingView() {
  const { t } = useTranslation("loading");
  const setView = useAppViewStore((s) => s.setView);
  const target = useAppViewStore((s) => s.loadingTarget);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= STEP_KEYS.length) {
      const timeout = window.setTimeout(() => setView(target), STEP_INTERVAL_MS);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(
      () => setStepIndex((i) => i + 1),
      STEP_INTERVAL_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [stepIndex, setView, target]);

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Box className="h-6 w-6" />
      </div>

      <p className="mt-5 flex items-center gap-2 text-sm">
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <span>{t("title", { name: DEMO_PROJECT_NAME })}</span>
      </p>

      <ul className="mt-8 space-y-1.5 font-mono text-xs">
        {STEP_KEYS.map((key, i) => (
          <li
            key={key}
            className={cn(
              "flex items-center gap-2 transition-colors",
              i < stepIndex && "text-muted-foreground/60",
              i === stepIndex && "text-primary",
              i > stepIndex && "text-muted-foreground/30",
            )}
          >
            <span aria-hidden="true">→</span>
            {t(`steps.${key}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
