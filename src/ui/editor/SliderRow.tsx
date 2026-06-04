import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}

/** Label + native range + number box, kept in sync. Emits onChange(number) on
 *  every move; the caller's Command coalesces a drag into one undo. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: Props) {
  const emit = (raw: string) => {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) onChange(n);
  };
  return (
    <div className="grid grid-cols-[80px_1fr_56px] items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => emit(e.target.value)}
        className={cn("w-full", disabled && "opacity-50")}
      />
      <input
        type="number"
        aria-label={`${label} value`}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => emit(e.target.value)}
        className={cn(
          "w-full rounded border border-border bg-background/50 px-1 py-0.5 text-right font-mono text-[11px] outline-none focus:border-primary",
          disabled && "cursor-not-allowed opacity-50",
        )}
      />
    </div>
  );
}
