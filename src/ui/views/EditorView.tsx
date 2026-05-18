import { useTranslation } from "react-i18next";
import { Box, X } from "lucide-react";

import { useAppViewStore } from "@/services/app-view/store";
import { useSceneStore } from "@/services/scene/store";
import { ThreeViewport } from "@/ui/viewport/ThreeViewport";

export function EditorView() {
  const { t } = useTranslation(["common", "editor"]);
  const setView = useAppViewStore((s) => s.setView);
  const project = useSceneStore((s) => s.project);
  const setProject = useSceneStore((s) => s.setProject);

  const closeProject = () => {
    setProject(null);
    setView("startup");
  };

  const rootNodes = project
    ? project.scene.root_node_ids
        .map((id) => project.scene.nodes[id])
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
    : [];

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
            onClick={closeProject}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            title={t("editor:close_project")}
          >
            <X className="h-3 w-3" />
            <span>{t("editor:close_project")}</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {rootNodes.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t("editor:hierarchy.empty")}
            </p>
          ) : (
            <ul className="space-y-0.5 font-mono text-[11px]">
              {rootNodes.map((node) => (
                <li
                  key={node.id}
                  className="rounded px-2 py-1 text-foreground/90 hover:bg-muted"
                >
                  <span className="text-muted-foreground">
                    {iconForKind(node.type)}
                  </span>{" "}
                  {node.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="relative">
        {project ? (
          <ThreeViewport />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="font-mono text-sm text-muted-foreground">
                {t("editor:viewport.empty")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("editor:viewport.empty_hint")}
              </p>
            </div>
          </div>
        )}
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

function iconForKind(kind: string): string {
  switch (kind) {
    case "group":
      return "▸";
    case "mesh":
      return "◼";
    case "light":
      return "✦";
    case "camera":
      return "▦";
    case "helper":
      return "◇";
    default:
      return "•";
  }
}
