import { useTranslation } from "react-i18next";

interface BobValue {
  axis: "x" | "y" | "z";
  amplitude: number;
  frequency: number;
}

interface Props {
  value: BobValue;
  onChange: (next: BobValue) => void;
  disabled: boolean;
  instanceId: string;
}

export function BobForm({ value, onChange, disabled, instanceId }: Props) {
  const { t } = useTranslation("editor");
  const groupName = `bob-axis-${instanceId}`;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3">
        <label className="w-16 text-zinc-400">{t("behaviors.axis")}</label>
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
        <label className="w-16 text-zinc-400">{t("behaviors.amplitude")}</label>
        <input
          type="number"
          value={value.amplitude}
          step="0.1"
          disabled={disabled}
          onChange={(e) => onChange({ ...value, amplitude: Number(e.target.value) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 disabled:opacity-50"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="w-16 text-zinc-400">{t("behaviors.frequency")}</label>
        <input
          type="number"
          value={value.frequency}
          step="0.1"
          disabled={disabled}
          onChange={(e) => onChange({ ...value, frequency: Number(e.target.value) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 disabled:opacity-50"
        />
        <span className="text-zinc-500">{t("behaviors.frequency_unit")}</span>
      </div>
    </div>
  );
}
