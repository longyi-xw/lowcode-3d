import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, X } from "lucide-react";

import { useSceneStore } from "@/services/scene/store";
import { useAssetPreviewStore } from "@/services/assets/preview-store";
import { useUIStore, type GizmoMode, type RightPanelTab } from "@/services/ui/store";
import { executeCommand } from "@/services/command-history";
import { closeProject } from "@/services/project/actions";
import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { isEffectivelyLocked } from "@/core/scene/policy";
import type { AssetReference, SceneNode, Transform } from "@/core/scene/types";
import { eulerDegToQuat, quatToEulerDeg } from "@/lib/euler";
import { BehaviorsPanel } from "@/ui/editor/BehaviorsPanel";
import { MaterialSection } from "@/ui/editor/MaterialSection";
import { ShortcutsHelpDialog } from "@/ui/help/ShortcutsHelpDialog";
import { LibraryPanel } from "@/ui/library/LibraryPanel";
import { PlayButton } from "@/ui/viewport/PlayButton";
import { ThreeViewport } from "@/ui/viewport/ThreeViewport";
import { useEditorShortcuts } from "@/ui/viewport/use-editor-shortcuts";
import { useGizmoShortcuts } from "@/ui/viewport/use-gizmo-shortcuts";
import { cn } from "@/lib/utils";
import { HierarchyTree } from "./HierarchyTree";

const GIZMO_MODES: { mode: GizmoMode; label: string; hotkey: string }[] = [
  { mode: "translate", label: "Move", hotkey: "G" },
  { mode: "rotate", label: "Rotate", hotkey: "R" },
  { mode: "scale", label: "Scale", hotkey: "S" },
];

type Vec3 = [number, number, number];

export function EditorView() {
  const { t } = useTranslation(["common", "editor"]);
  const project = useSceneStore((s) => s.project);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const expandedNodes = useUIStore((s) => s.expandedNodes);
  const toggleNodeExpanded = useUIStore((s) => s.toggleNodeExpanded);
  const gizmoMode = useUIStore((s) => s.gizmoMode);
  const setGizmoMode = useUIStore((s) => s.setGizmoMode);
  const rightPanelTab = useUIStore((s) => s.rightPanelTab);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);
  const playState = useUIStore((s) => s.playState);
  useGizmoShortcuts();
  useEditorShortcuts();

  const selectedNode =
    project && selectedNodeId ? project.scene.nodes[selectedNodeId] : undefined;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <section className="grid min-h-0 flex-1 grid-cols-[240px_1fr_320px] overflow-hidden">
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
              onClick={() => void closeProject()}
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

        {/* Center column: viewport + bottom asset-library drawer. The drawer
            stays under the viewport only, and the 1fr column auto-widens if the
            side asides ever collapse. */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <main className="relative min-h-0 flex-1 overflow-hidden">
            {project ? (
              <>
                <ThreeViewport />
                <GizmoModeToolbar
                  mode={gizmoMode}
                  disabled={selectedNodeId === null}
                  onChange={setGizmoMode}
                />
                <div className="absolute right-3 top-3 z-10">
                  <PlayButton />
                </div>
              </>
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
          <LibraryPanel />
        </div>

        {/* Properties / Behaviors */}
        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border">
          <div className="flex shrink-0 border-b border-border">
            {(["properties", "behaviors"] as RightPanelTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRightPanelTab(tab)}
                className={cn(
                  "flex-1 px-3 py-2 font-mono text-[11px] uppercase tracking-wider",
                  rightPanelTab === tab
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "properties"
                  ? t("editor:behaviors.properties_tab_title")
                  : t("editor:behaviors.tab_title")}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto text-xs">
            {rightPanelTab === "properties" ? (
              <fieldset
                disabled={playState === "play"}
                className="border-0 p-3 disabled:opacity-60"
              >
                {selectedNode ? (
                  <NodeProperties node={selectedNode} />
                ) : (
                  <p className="text-muted-foreground">
                    {t("editor:properties.empty")}
                  </p>
                )}
              </fieldset>
            ) : (
              <BehaviorsPanel />
            )}
          </div>
        </aside>
      </section>
      <ShortcutsHelpDialog />
    </div>
  );
}

function NodeProperties({ node }: { node: SceneNode }) {
  const locked = isEffectivelyLocked(node);
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
        disabled={locked}
        onChange={(position) => commitTransform({ position })}
      />
      <Vec3Row
        label="rotation°"
        value={quatToEulerDeg(node.transform.rotation)}
        disabled={locked}
        onChange={(eulerDeg) => commitTransform({ rotation: eulerDegToQuat(eulerDeg) })}
      />
      <Vec3Row
        label="scale"
        value={node.transform.scale}
        disabled={locked}
        onChange={(scale) => commitTransform({ scale })}
      />
      <ReadonlyRow label="visible" value={node.visible ? "true" : "false"} />
      <ReadonlyRow label="locked" value={locked ? "true" : "false"} />
      {node.data.type === "prefab_instance" && (
        <PrefabInfo assetId={node.data.asset_id} />
      )}
      {node.data.type === "mesh" && <MaterialSection node={node} />}
    </dl>
  );
}

function PrefabInfo({ assetId }: { assetId: string }) {
  const { t } = useTranslation("editor");
  const asset = useSceneStore((s) => s.project?.assets.find((a) => a.id === assetId));
  const previewTree = useAssetPreviewStore((s) => s.trees[assetId]);

  if (!asset) {
    return <ReadonlyRow label="asset" value={`${assetId} (missing)`} />;
  }

  return (
    <>
      <div className="mt-2 border-t border-border pt-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t("properties.prefab_section")}
        </p>
        <ReadonlyRow label="asset id" value={asset.id} />
        <ReadonlyRow label="filename" value={describeSource(asset)} />
        <ReadonlyRow
          label="content hash"
          value={asset.content_hash.slice(0, 12) + "…"}
        />
        <ReadonlyRow label="path" value={asset.relative_path} />
        {previewTree && (
          <ReadonlyRow label="meshes" value={String(countMeshes(previewTree))} />
        )}
      </div>
    </>
  );
}

function describeSource(asset: AssetReference): string {
  if (asset.source.kind === "user_upload") return asset.source.original_filename;
  if (asset.source.kind === "builtin") return `builtin: ${asset.source.library_id}`;
  if (asset.source.kind === "online") return asset.source.url;
  if (asset.source.kind === "ai_generated")
    return `ai (${asset.source.model}): ${asset.source.prompt.slice(0, 32)}`;
  return "—";
}

function countMeshes(node: {
  kind: string;
  children: Array<{ kind: string; children: unknown[] }>;
}): number {
  let count = node.kind === "mesh" ? 1 : 0;
  for (const child of node.children) {
    count += countMeshes(child as never);
  }
  return count;
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
  disabled = false,
  onChange,
}: {
  label: string;
  value: Vec3;
  disabled?: boolean;
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
            disabled={disabled}
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
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
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
    <label
      className={cn(
        "flex items-center gap-1 rounded border border-border bg-background/50 px-1.5 py-0.5",
        disabled ? "cursor-not-allowed opacity-50" : "focus-within:border-primary",
      )}
    >
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
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
        className={cn(
          "w-0 flex-1 bg-transparent text-right font-mono text-[11px] text-foreground outline-none",
          disabled && "cursor-not-allowed",
        )}
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

function GizmoModeToolbar({
  mode,
  disabled,
  onChange,
}: {
  mode: GizmoMode;
  disabled: boolean;
  onChange: (mode: GizmoMode) => void;
}) {
  return (
    <div
      className={cn(
        "absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover/90 px-1.5 py-1 text-[11px] shadow-lg backdrop-blur-sm",
        disabled && "opacity-50",
      )}
    >
      {GIZMO_MODES.map((entry) => {
        const active = entry.mode === mode;
        return (
          <button
            key={entry.mode}
            type="button"
            onClick={() => onChange(entry.mode)}
            disabled={disabled}
            title={`${entry.label} (${entry.hotkey})`}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
              disabled && "cursor-not-allowed",
            )}
          >
            <span>{entry.label}</span>
            <span
              className={cn(
                "font-mono text-[10px]",
                active ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {entry.hotkey}
            </span>
          </button>
        );
      })}
    </div>
  );
}
