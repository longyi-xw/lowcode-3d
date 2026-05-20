import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { SceneNode, SceneProject } from "@/core/scene/types";
import {
  useAssetPreviewStore,
  type PrefabPreviewNode,
} from "@/services/assets/preview-store";
import { cn } from "@/lib/utils";

interface HierarchyTreeProps {
  project: SceneProject;
  selectedNodeId: string | null;
  expandedNodes: Record<string, boolean>;
  onSelect: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
}

export function HierarchyTree({
  project,
  selectedNodeId,
  expandedNodes,
  onSelect,
  onToggleExpand,
}: HierarchyTreeProps) {
  return (
    <ul role="tree" className="space-y-0.5 font-mono text-[11px]">
      {project.scene.root_node_ids.map((id) => (
        <HierarchyRow
          key={id}
          nodeId={id}
          depth={0}
          project={project}
          selectedNodeId={selectedNodeId}
          expandedNodes={expandedNodes}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </ul>
  );
}

interface HierarchyRowProps {
  nodeId: string;
  depth: number;
  project: SceneProject;
  selectedNodeId: string | null;
  expandedNodes: Record<string, boolean>;
  onSelect: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
}

function HierarchyRow({
  nodeId,
  depth,
  project,
  selectedNodeId,
  expandedNodes,
  onSelect,
  onToggleExpand,
}: HierarchyRowProps) {
  const { t } = useTranslation("editor");
  const node = project.scene.nodes[nodeId];
  // Hooks must run unconditionally — we always read the prefab preview store
  // even when the node isn't a prefab_instance (the selector returns null).
  // Without this, conditional early-return below would violate the rules of
  // hooks. The selector keeps re-render cost trivial: it returns `null` for
  // every non-prefab node, so `useAssetPreviewStore` only triggers a render
  // when a preview tree this row actually depends on changes.
  const previewTree = useAssetPreviewStore((s) => {
    if (!node || node.data.type !== "prefab_instance") return null;
    return s.trees[node.data.asset_id] ?? null;
  });
  if (!node) return null;

  const active = nodeId === selectedNodeId;
  const expanded = expandedNodes[nodeId] === true;
  const isPrefab = node.type === "prefab_instance";
  const hasOwnChildren = node.children_ids.length > 0;
  // Prefab instances are always "expandable" — when the preview tree is in
  // flight we still show the caret so the user can twirl it open and see
  // "loading…". This matches Unity/Blender's behaviour: the prefab row
  // commits to being expandable, then the contents render asynchronously.
  const hasChildren = hasOwnChildren || isPrefab;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        // Caret + body are split into two buttons to keep keyboard and
        // screen-reader semantics sane: clicking the row selects, clicking
        // the caret toggles. Avoid wrapping the whole row in one <button>
        // because nested buttons aren't valid HTML.
        className={cn(
          "flex w-full items-center gap-1 rounded transition",
          active ? "bg-primary/15 text-primary" : "text-foreground/90 hover:bg-muted",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "collapse" : "expand"}
            onClick={() => onToggleExpand(nodeId)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/60"
          >
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(active ? null : nodeId)}
          className="flex flex-1 items-center gap-1.5 py-1 pr-2 text-left"
        >
          <span className={cn(active ? "text-primary" : "text-muted-foreground")}>
            {iconForKind(node.type)}
          </span>
          <span className="truncate">{node.name}</span>
          {isPrefab && (
            <span className="ml-1 rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wider text-muted-foreground">
              {t("hierarchy.prefab_badge")}
            </span>
          )}
        </button>
      </div>

      {hasOwnChildren && expanded && (
        <ul role="group" className="space-y-0.5">
          {node.children_ids.map((childId) => (
            <HierarchyRow
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              project={project}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      )}

      {isPrefab && expanded && (
        <ul role="group" className="space-y-0.5">
          {previewTree ? (
            previewTree.children.map((child, i) => (
              <PrefabPreviewRow key={`${nodeId}/${i}`} node={child} depth={depth + 1} />
            ))
          ) : (
            <li
              role="treeitem"
              className="cursor-default select-none py-1 italic text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
            >
              {t("hierarchy.prefab_loading")}
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/**
 * Read-only row inside a prefab_instance's expanded preview. Not selectable
 * — the underlying glTF nodes aren't SceneNodes, so there's no id to feed
 * the gizmo / properties panel. v2's "unpack" command is the migration path
 * that turns these previews into real, editable SceneNodes.
 */
function PrefabPreviewRow({ node, depth }: { node: PrefabPreviewNode; depth: number }) {
  return (
    <li role="treeitem" aria-expanded={node.children.length > 0 || undefined}>
      <div
        className="flex w-full items-center gap-1 rounded text-muted-foreground"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={node.name}
      >
        <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex flex-1 items-center gap-1.5 py-1 pr-2 text-left opacity-70">
          <span aria-hidden="true">{iconForPrefabKind(node.kind)}</span>
          <span className="truncate">{node.name}</span>
        </span>
      </div>
      {node.children.length > 0 && (
        <ul role="group" className="space-y-0.5">
          {node.children.map((child, i) => (
            <PrefabPreviewRow key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function iconForKind(kind: SceneNode["type"]): string {
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
    case "prefab_instance":
      return "❖";
    default:
      return "•";
  }
}

function iconForPrefabKind(kind: PrefabPreviewNode["kind"]): string {
  switch (kind) {
    case "group":
      return "▸";
    case "mesh":
      return "◼";
    default:
      return "·";
  }
}
