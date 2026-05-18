import { useTranslation } from "react-i18next";
import { Box, X } from "lucide-react";

import { useAppViewStore } from "@/services/app-view/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";
import { ThreeViewport } from "@/ui/viewport/ThreeViewport";
import type { SceneNode } from "@/core/scene/types";
import { cn } from "@/lib/utils";

export function EditorView() {
  const { t } = useTranslation(["common", "editor"]);
  const setView = useAppViewStore((s) => s.setView);
  const project = useSceneStore((s) => s.project);
  const setProject = useSceneStore((s) => s.setProject);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);

  const closeProject = () => {
    setProject(null);
    setSelectedNodeId(null);
    setView("startup");
  };

  const rootNodes = project
    ? project.scene.root_node_ids
        .map((id) => project.scene.nodes[id])
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
    : [];

  const selectedNode =
    project && selectedNodeId ? project.scene.nodes[selectedNodeId] : undefined;

  return (
    <section className="grid h-screen w-screen grid-cols-[240px_1fr_320px] overflow-hidden bg-background text-foreground">
      {/* Hierarchy */}
      <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
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
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {rootNodes.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">
              {t("editor:hierarchy.empty")}
            </p>
          ) : (
            <ul className="space-y-0.5 font-mono text-[11px]">
              {rootNodes.map((node) => {
                const active = node.id === selectedNodeId;
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(active ? null : node.id)}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left transition",
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-foreground/90 hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {iconForKind(node.type)}
                      </span>
                      <span className="truncate">{node.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Viewport */}
      <main className="relative h-full min-w-0 overflow-hidden">
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

      {/* Properties */}
      <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border">
        <header className="shrink-0 border-b border-border px-3 py-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("editor:properties.title")}
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
          {selectedNode ? (
            <NodeProperties node={selectedNode} />
          ) : (
            <p className="text-muted-foreground">{t("editor:properties.empty")}</p>
          )}
        </div>
      </aside>
    </section>
  );
}

function NodeProperties({ node }: { node: SceneNode }) {
  return (
    <dl className="space-y-2 font-mono text-[11px]">
      <Row label="id" value={node.id} />
      <Row label="name" value={node.name} />
      <Row label="type" value={node.type} />
      <Row
        label="position"
        value={node.transform.position.map(formatNumber).join(", ")}
      />
      <Row
        label="rotation"
        value={node.transform.rotation.map(formatNumber).join(", ")}
      />
      <Row label="scale" value={node.transform.scale.map(formatNumber).join(", ")} />
      <Row label="visible" value={node.visible ? "true" : "false"} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground/90">{value}</dd>
    </div>
  );
}

function formatNumber(n: number): string {
  return Math.abs(n) < 1e-3 ? "0" : n.toFixed(3).replace(/\.?0+$/, "");
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
