import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AddBehaviorCommand } from "@/core/command/commands/add-behavior";
import { RemoveBehaviorCommand } from "@/core/command/commands/remove-behavior";
import { SetBehaviorEnabledCommand } from "@/core/command/commands/set-behavior-enabled";
import { SetBehaviorParametersCommand } from "@/core/command/commands/set-behavior-parameters";
import { generateUUID } from "@/core/id/uuid";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { getSceneEditorStore, useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { BehaviorRow } from "./BehaviorRow";

const SUPPORTED_BEHAVIORS: Array<{
  type: string;
  defaultParams: Record<string, unknown>;
}> = [{ type: "auto-rotate", defaultParams: { axis: "y", speed: 30 } }];

export function BehaviorsPanel() {
  const { t } = useTranslation("editor");
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const playState = useUIStore((s) => s.playState);
  const node = useSceneStore((s) =>
    selectedNodeId ? s.project?.scene.nodes[selectedNodeId] : undefined,
  );
  const exec = useCommandHistoryStore((s) => s.execute);

  const [addOpen, setAddOpen] = useState(false);
  const disabled = playState === "play";

  if (!node) return null;

  const editor = getSceneEditorStore();

  function addBehavior(behavior_type: string, defaultParams: Record<string, unknown>) {
    if (!node) return;
    const newBinding = {
      id: generateUUID(),
      behavior_type,
      enabled: true,
      parameters: defaultParams,
    };
    exec(new AddBehaviorCommand({ node_id: node.id, binding: newBinding }), editor);
    setAddOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="truncate text-zinc-200">{node.name}</span>
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAddOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-left disabled:opacity-50"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span className="flex-1">{t("behaviors.add_behavior")}</span>
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
        {addOpen && (
          <div className="absolute z-10 mt-1 w-full rounded border border-zinc-700 bg-zinc-900 shadow">
            {SUPPORTED_BEHAVIORS.map((def) => (
              <button
                key={def.type}
                type="button"
                className="block w-full px-2 py-1 text-left hover:bg-zinc-800"
                onClick={() => addBehavior(def.type, def.defaultParams)}
              >
                {t(`behaviors.${def.type.replace("-", "_")}_name`, {
                  defaultValue: def.type,
                })}
              </button>
            ))}
          </div>
        )}
      </div>

      {node.behaviors.length === 0 && (
        <div className="rounded border border-dashed border-zinc-800 p-3 text-center text-zinc-500">
          {t("behaviors.empty_state")}
        </div>
      )}

      {node.behaviors.map((b) => (
        <BehaviorRow
          key={b.id}
          binding={b}
          disabled={disabled}
          onToggleEnabled={(enabled) =>
            exec(
              new SetBehaviorEnabledCommand({
                node_id: node.id,
                binding_id: b.id,
                enabled,
                prev_enabled: b.enabled,
              }),
              editor,
            )
          }
          onChangeParams={(parameters) =>
            exec(
              new SetBehaviorParametersCommand({
                node_id: node.id,
                binding_id: b.id,
                parameters,
                prev_parameters: b.parameters,
              }),
              editor,
            )
          }
          onRemove={() =>
            exec(
              new RemoveBehaviorCommand({
                node_id: node.id,
                prev_binding: b,
              }),
              editor,
            )
          }
        />
      ))}
    </div>
  );
}
