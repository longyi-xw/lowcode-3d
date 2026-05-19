import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, X } from "lucide-react";

import { useAppViewStore } from "@/services/app-view/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";
import { executeCommand } from "@/services/command-history";
import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import type { SceneNode, Transform } from "@/core/scene/types";
import { ThreeViewport } from "@/ui/viewport/ThreeViewport";
import { HierarchyTree } from "./HierarchyTree";

type Vec3 = [number, number, number];

export function EditorView() {
  const { t } = useTranslation(["common", "editor"]);
  const setView = useAppViewStore((s) => s.setView);
  const project = useSceneStore((s) => s.project);
  const setProject = useSceneStore((s) => s.setProject);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const expandedNodes = useUIStore((s) => s.expandedNodes);
  const toggleNodeExpanded = useUIStore((s) => s.toggleNodeExpanded);

  const closeProject = () => {
    setProject(null);
    setSelectedNodeId(null);
    setView("startup");
  };

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
          {project && project.scene.root_node_ids.length > 0 ? (
            <HierarchyTree
              project={project}
              selectedNodeId={selectedNodeId}
              expandedNodes={expandedNodes}
              onSelect={setSelectedNodeId}
              onToggleExpand={toggleNodeExpanded}
            />
          ) : (
            <p className="px-1 text-xs text-muted-foreground">
              {t("editor:hierarchy.empty")}
            </p>
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
  const commitTransform = (next: Partial<Transform>) => {
    const newTransform: Transform = {
      position: next.position ?? node.transform.position,
      rotation: next.rotation ?? node.transform.rotation,
      scale: next.scale ?? node.transform.scale,
    };
    if (transformsEqual(newTransform, node.transform)) return;
    executeCommand(
      new SetNodeTransformCommand({
        node_id: node.id,
        transform: newTransform,
        prev_transform: node.transform,
      }),
    );
  };

  return (
    <dl className="space-y-3 font-mono text-[11px]">
      <ReadonlyRow label="id" value={node.id} />
      <ReadonlyRow label="name" value={node.name} />
      <ReadonlyRow label="type" value={node.type} />
      <Vec3Row
        label="position"
        value={node.transform.position}
        onChange={(position) => commitTransform({ position })}
      />
      {/* Rotation stays read-only this commit; TransformControls handles it next. */}
      <ReadonlyRow
        label="rotation"
        value={node.transform.rotation.map(formatNumber).join(", ")}
      />
      <Vec3Row
        label="scale"
        value={node.transform.scale}
        onChange={(scale) => commitTransform({ scale })}
      />
      <ReadonlyRow label="visible" value={node.visible ? "true" : "false"} />
    </dl>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground/90">{value}</dd>
    </div>
  );
}

function Vec3Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Vec3;
  onChange: (next: Vec3) => void;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="grid grid-cols-3 gap-1">
        {(["x", "y", "z"] as const).map((axis, i) => (
          <NumberInput
            key={axis}
            label={axis}
            value={value[i] ?? 0}
            onChange={(v) => {
              const next: Vec3 = [value[0], value[1], value[2]];
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </dd>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const [text, setText] = useState(() => formatNumber(value));
  // Sync from props on external changes (undo/redo, gizmo) via the React-19-
  // sanctioned "compare during render with a state anchor" pattern, NOT
  // useEffect+setState (that's the cascading-render anti-pattern) and NOT a
  // ref (refs can't be read or written during render).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatNumber(value));
  }

  const commit = () => {
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) {
      setText(formatNumber(value));
      return;
    }
    if (parsed !== value) onChange(parsed);
    setText(formatNumber(parsed));
  };

  return (
    <label className="flex items-center gap-1 rounded border border-border bg-background/50 px-1.5 py-0.5 focus-within:border-primary">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setText(formatNumber(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-0 flex-1 bg-transparent text-right font-mono text-[11px] text-foreground outline-none"
      />
    </label>
  );
}

function transformsEqual(a: Transform, b: Transform): boolean {
  return (
    vec3Equal(a.position, b.position) &&
    quatEqual(a.rotation, b.rotation) &&
    vec3Equal(a.scale, b.scale)
  );
}

function vec3Equal(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function quatEqual(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function formatNumber(n: number): string {
  return Math.abs(n) < 1e-4 ? "0" : Number(n.toFixed(3)).toString();
}
