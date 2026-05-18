import { useTranslation } from "react-i18next";
import {
  Box,
  FileBox,
  FilePlus,
  FolderOpen,
  GitBranch,
  LayoutTemplate,
  Link2,
  Moon,
  Sun,
  SunMoon,
} from "lucide-react";
import { useAppViewStore, type LoadingTarget } from "@/services/app-view/store";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { useSettingsStore } from "@/services/settings/store";
import { useSceneStore } from "@/services/scene/store";
import { createDemoProject } from "@/services/scene/demo-project";
import { cn } from "@/lib/utils";

export function StartupView() {
  const { t, i18n } = useTranslation(["common", "startup", "settings"]);
  const startLoading = useAppViewStore((s) => s.startLoading);
  const setProject = useSceneStore((s) => s.setProject);
  const { setLanguage, theme, setTheme } = useSettingsStore();

  // Most project actions stage a demo project before the loading view, so the
  // editor lands on something visible. Clone-from-URL deliberately routes to
  // the "error" target without setting a project so the error view is
  // reachable through normal UI (it simulates a fetch / schema-mismatch).
  const open = (target: LoadingTarget, projectName?: string) => () => {
    if (target === "editor") {
      setProject(
        createDemoProject(projectName ?? t("startup:start.new_project_default_name")),
      );
    } else {
      setProject(null);
    }
    startLoading(target);
  };

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Box className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">{t("common:app.name")}</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("common:app.scaffold_status")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {SUPPORTED_LANGUAGES.map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              className={cn(
                "rounded px-2 py-1 text-xs",
                i18n.resolvedLanguage === lng
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
              title={t(`settings:language.options.${lng}` as const)}
            >
              {lng === "zh-CN" ? "中" : "EN"}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={cycleTheme}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title={`theme: ${theme}`}
            aria-label={`theme: ${theme}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 gap-10 px-10 py-10">
        <aside className="w-60 shrink-0 space-y-8">
          <section>
            <SectionHeading>{t("startup:start.heading")}</SectionHeading>
            <RailAction
              icon={<FilePlus className="h-4 w-4" />}
              label={t("startup:start.new_project")}
              shortcut="⌘N"
              onClick={open("editor", t("startup:start.new_project_default_name"))}
            />
            <RailAction
              icon={<FolderOpen className="h-4 w-4" />}
              label={t("startup:start.open_project")}
              shortcut="⌘O"
              onClick={open("editor")}
            />
            <RailAction
              icon={<Link2 className="h-4 w-4" />}
              label={t("startup:start.clone_from_url")}
              onClick={open("error")}
            />
            <RailAction
              icon={<FileBox className="h-4 w-4" />}
              label={t("startup:start.import_glb")}
              onClick={open("editor")}
            />
          </section>

          <section>
            <SectionHeading>{t("startup:templates.heading")}</SectionHeading>
            <RailAction
              icon={<LayoutTemplate className="h-4 w-4" />}
              label={t("startup:templates.three_vite")}
              onClick={open("editor", t("startup:templates.three_vite"))}
            />
            <RailAction
              icon={<GitBranch className="h-4 w-4" />}
              label={t("startup:templates.r3f_next")}
              badge={t("startup:templates.soon_badge")}
              disabled
            />
          </section>
        </aside>

        <div className="flex-1 space-y-10">
          <section>
            <SectionHeading>{t("startup:recent.heading")}</SectionHeading>
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm text-foreground/80">{t("startup:recent.empty")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("startup:recent.empty_hint")}
              </p>
            </div>
          </section>

          <section>
            <SectionHeading>{t("startup:tips.heading")}</SectionHeading>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <TipCard
                title={t("startup:tips.keyboard.title")}
                body={t("startup:tips.keyboard.body")}
              />
              <TipCard
                title={t("startup:tips.git.title")}
                body={t("startup:tips.git.body")}
              />
              <TipCard
                title={t("startup:tips.ai_key.title")}
                body={t("startup:tips.ai_key.body")}
              />
            </div>
          </section>
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-border px-6 py-3 font-mono text-[11px] text-muted-foreground">
        <span>{t("startup:footer.links")}</span>
        <span>{t("common:app.scaffold_status")}</span>
      </footer>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function RailAction({
  icon,
  label,
  shortcut,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition",
        disabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : "text-foreground hover:bg-muted",
      )}
    >
      <span
        className={cn(disabled ? "text-muted-foreground/40" : "text-muted-foreground")}
      >
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {badge}
        </span>
      )}
      {shortcut && !disabled && (
        <span className="font-mono text-[11px] text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

function TipCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-medium text-foreground">{title}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
