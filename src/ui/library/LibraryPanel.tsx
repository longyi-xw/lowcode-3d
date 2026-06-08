import { ChevronDown, ChevronUp, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AddNodeCommand } from "@/core/command/commands/add-node";
import { cn } from "@/lib/utils";
import { executeCommand } from "@/services/command-history";
import { beginAssetDrag } from "@/services/library/asset-drag";
import {
  BUILTIN_LIBRARY_ITEMS,
  type LibraryItem,
  uploadLibraryItems,
} from "@/services/library/catalog";
import { uploadGlbToLibrary } from "@/services/project/actions";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

type Category = "geometry" | "light" | "upload";
const CATEGORIES: Category[] = ["geometry", "light", "upload"];

/**
 * Bottom drawer asset library. Collapsed by default (just a title bar);
 * expand via the chevron or Cmd/Ctrl+J. Browse builtins (geometry / light) and
 * the project's uploaded models by category, filter by name, and double-click a
 * card to drop it into the scene (AddNodeCommand — undoable). The "Upload .glb"
 * button adds a model to the library without placing a node.
 */
export function LibraryPanel() {
  const { t } = useTranslation("editor");
  const open = useUIStore((s) => s.libraryOpen);
  const setLibraryOpen = useUIStore((s) => s.setLibraryOpen);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const assets = useSceneStore((s) => s.project?.assets);
  const hasProject = useSceneStore((s) => s.project !== null);

  const [category, setCategory] = useState<Category>("geometry");
  const [query, setQuery] = useState("");

  const uploadItems = useMemo(() => uploadLibraryItems(assets ?? []), [assets]);

  const labelFor = (item: LibraryItem): string =>
    item.nameKey
      ? t(item.nameKey, { defaultValue: item.name ?? item.id })
      : (item.name ?? item.id);

  const items = useMemo(() => {
    const source =
      category === "upload"
        ? uploadItems
        : BUILTIN_LIBRARY_ITEMS.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((i) => labelFor(i).toLowerCase().includes(q));
    // labelFor closes over `t`; recompute when the active language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, uploadItems, query, t]);

  function addItem(item: LibraryItem) {
    const node = item.makeNode();
    executeCommand(new AddNodeCommand({ node }));
    setSelectedNodeId(node.id);
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-background">
      <button
        type="button"
        onClick={() => setLibraryOpen(!open)}
        className="flex shrink-0 items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50"
        title={t("shortcuts.toggle_library")}
      >
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {t("library.title")}
        </p>
        <span className="ml-auto text-muted-foreground">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
      </button>

      {open && (
        <div className="flex h-44 flex-col border-t border-border">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
            <div className="flex gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px]",
                    category === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t(`library.tab.${c}`)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("library.search")}
              className="ml-2 w-32 rounded border border-border bg-background/50 px-2 py-0.5 text-[11px] outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!hasProject}
              onClick={() => void uploadGlbToLibrary()}
              className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Upload className="h-3 w-3" aria-hidden="true" />
              <span>{t("library.upload")}</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {category === "upload" && uploadItems.length === 0 ? (
              <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">
                {t("library.empty_uploads")}
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      draggable={false}
                      onPointerDown={(e) =>
                        beginAssetDrag(item.id, e.clientX, e.clientY)
                      }
                      onDoubleClick={() => addItem(item)}
                      title={t("library.add_hint")}
                      className="flex flex-col items-center gap-1 rounded border border-border bg-card/50 p-2 hover:border-primary hover:bg-muted"
                    >
                      <Icon className="h-6 w-6 text-foreground/80" aria-hidden="true" />
                      <span className="w-full truncate text-center text-[10px] text-foreground/90">
                        {labelFor(item)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
