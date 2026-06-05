import { useTranslation } from "react-i18next";

import { SetMaterialOverrideCommand } from "@/core/command/commands/set-material-override";
import { type MaterialOverride, resolveMaterial } from "@/core/scene/material";
import type { SceneNode } from "@/core/scene/types";
import { executeCommand } from "@/services/command-history";

import { SliderRow } from "./SliderRow";

export function MaterialSection({ node }: { node: SceneNode }) {
  const { t } = useTranslation("editor");
  if (node.data.type !== "mesh") return null;

  const cur = node.data.material_overrides?.[0];
  const m = resolveMaterial(cur);

  // Build the full override literal per field with explicit field names —
  // a computed `{ ...cur, [field]: value }` would widen the key to
  // `string | number` and not satisfy MaterialOverride. `...cur` is a no-op
  // when cur is undefined (first edit).
  const commit = (override: MaterialOverride) =>
    executeCommand(
      new SetMaterialOverrideCommand({
        node_id: node.id,
        override,
        prev_override: cur,
      }),
    );

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-3 font-mono text-[11px]">
      <p className="mb-1 uppercase tracking-wider text-muted-foreground">
        {t("properties.material.section")}
      </p>

      <ColorField
        label={t("properties.material.base_color")}
        value={m.color}
        onChange={(v) => commit({ slot: 0, ...cur, color: v })}
      />
      <SliderRow
        label={t("properties.material.metalness")}
        value={m.metalness}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => commit({ slot: 0, ...cur, metalness: v })}
      />
      <SliderRow
        label={t("properties.material.roughness")}
        value={m.roughness}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => commit({ slot: 0, ...cur, roughness: v })}
      />
      <ColorField
        label={t("properties.material.emissive")}
        value={m.emissive}
        onChange={(v) => commit({ slot: 0, ...cur, emissive: v })}
      />
      <SliderRow
        label={t("properties.material.emissive_intensity")}
        value={m.emissive_intensity}
        min={0}
        max={4}
        step={0.1}
        onChange={(v) => commit({ slot: 0, ...cur, emissive_intensity: v })}
      />
      <SliderRow
        label={t("properties.material.opacity")}
        value={m.opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => commit({ slot: 0, ...cur, opacity: v })}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-12 rounded border border-border bg-transparent"
      />
    </div>
  );
}
