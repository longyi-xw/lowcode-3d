import { ChevronRight } from "lucide-react";

import type { SceneNode, SceneProject } from "@/core/scene/types";
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
  const node = project.scene.nodes[nodeId];
  if (!node) return null;

  const active = nodeId === selectedNodeId;
  const expanded = expandedNodes[nodeId] === true;
  const hasChildren = node.children_ids.length > 0;

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
        </button>
      </div>

      {hasChildren && expanded && (
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
    default:
      return "•";
  }
}
