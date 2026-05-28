import { useTranslation } from "react-i18next";

import type { BehaviorBinding } from "@/core/scene/types";

import { BEHAVIOR_FORM_REGISTRY } from "./behavior-params/registry";

interface Props {
  binding: BehaviorBinding;
  disabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  onChangeParams: (next: Record<string, unknown>) => void;
  onRemove: () => void;
}

export function BehaviorRow({
  binding,
  disabled,
  onToggleEnabled,
  onChangeParams,
  onRemove,
}: Props) {
  const { t } = useTranslation("editor");
  const Form = BEHAVIOR_FORM_REGISTRY[binding.behavior_type];
  const isUnknown = !Form;
  const displayName = isUnknown
    ? t("behaviors.unknown_type", { type: binding.behavior_type })
    : t(`behaviors.${binding.behavior_type.replace("-", "_")}_name`, {
        defaultValue: binding.behavior_type,
      });

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="enabled"
          checked={binding.enabled}
          disabled={disabled || isUnknown}
          onChange={(e) => onToggleEnabled(e.target.checked)}
        />
        <span className={`flex-1 truncate ${isUnknown ? "text-amber-400" : ""}`}>
          {displayName}
        </span>
        <button
          type="button"
          aria-label="remove"
          disabled={disabled}
          onClick={onRemove}
          className="rounded px-2 text-zinc-400 hover:text-red-400 disabled:opacity-50"
        >
          ×
        </button>
      </div>
      {!isUnknown && Form && (
        <Form
          value={binding.parameters}
          onChange={onChangeParams}
          disabled={disabled}
        />
      )}
    </div>
  );
}
