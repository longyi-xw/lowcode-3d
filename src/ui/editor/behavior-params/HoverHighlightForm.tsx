import { useTranslation } from "react-i18next";

interface HoverHighlightValue {
  color: string;
  intensity: number;
}

interface Props {
  value: HoverHighlightValue;
  onChange: (next: HoverHighlightValue) => void;
  disabled: boolean;
  instanceId: string;
}

export function HoverHighlightForm({ value, onChange, disabled }: Props) {
  const { t } = useTranslation("editor");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <label className="w-16 text-zinc-400">{t("behaviors.color")}</label>
        <input
          type="color"
          value={value.color}
          disabled={disabled}
          aria-label={t("behaviors.color")}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          className="h-7 w-12 rounded border border-zinc-700 bg-zinc-900 disabled:opacity-50"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-16 text-zinc-400">{t("behaviors.intensity")}</label>
        <input
          type="number"
          value={value.intensity}
          step="0.1"
          min="0"
          disabled={disabled}
          onChange={(e) => onChange({ ...value, intensity: Number(e.target.value) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 disabled:opacity-50"
        />
      </div>
    </div>
  );
}
