import { useTranslation } from "react-i18next";

interface AutoRotateValue {
  axis: "x" | "y" | "z";
  speed: number;
}

interface Props {
  value: AutoRotateValue;
  onChange: (next: AutoRotateValue) => void;
  disabled: boolean;
  instanceId: string;
}

export function AutoRotateForm({ value, onChange, disabled, instanceId }: Props) {
  const { t } = useTranslation("editor");
  const groupName = `auto-rotate-axis-${instanceId}`;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <label className="w-12 text-zinc-400">{t("behaviors.axis")}</label>
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis} className="flex items-center gap-1">
            <input
              type="radio"
              name={groupName}
              value={axis}
              checked={value.axis === axis}
              disabled={disabled}
              aria-label={axis}
              onChange={() => onChange({ ...value, axis })}
            />
            {axis.toUpperCase()}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="w-12 text-zinc-400">{t("behaviors.speed")}</label>
        <input
          type="number"
          value={value.speed}
          step="1"
          disabled={disabled}
          onChange={(e) => onChange({ ...value, speed: Number(e.target.value) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 disabled:opacity-50"
        />
        <span className="text-zinc-500">{t("behaviors.speed_unit")}</span>
      </div>
    </div>
  );
}
