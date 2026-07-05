interface BarProps {
  label: string;
  value: number; // 0..100
  /** Tailwind background color class for the fill. */
  color?: string;
  /** When true, a higher value is bad (pests/disease) — flips default color. */
  invert?: boolean;
  /** When true, applies danger pulse animation (used for health < 30). */
  danger?: boolean;
  /** When true, triggers stat-change flash animation. */
  justChanged?: boolean;
}

export function Bar({ label, value, color, invert = false, danger = false, justChanged = false }: BarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const fill =
    color ??
    (invert
      ? pct > 50
        ? "bg-red-500"
        : pct > 20
          ? "bg-amber-500"
          : "bg-grow-500"
      : pct < 25
        ? "bg-red-500"
        : pct < 50
          ? "bg-amber-500"
          : "bg-grow-500");

  return (
    <div className={danger ? "gpe-health-danger rounded-full p-1" : ""}>
      <div className="mb-0.5 flex justify-between text-[11px] text-gray-400">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(pct)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fill} ${justChanged ? "gpe-stat-flash" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
