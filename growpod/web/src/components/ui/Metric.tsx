import type { ReactNode } from "react";

/** A single instrument readout: label / big mono value / unit / optional sub. */
export function Metric({
  label,
  value,
  unit,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: "default" | "accent" | "grow" | "warn";
}) {
  const toneCls =
    tone === "accent"
      ? "text-accent-300"
      : tone === "grow"
        ? "text-grow-300"
        : tone === "warn"
          ? "text-amber-300"
          : "text-gray-100";
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2">
      <div className="instrument-label">{label}</div>
      <div className={`instrument-value mt-0.5 text-lg ${toneCls}`}>
        {value}
        {unit && <span className="ml-1 text-xs text-gray-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

export function MetricGrid({
  children,
  cols = 3,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const c = cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";
  return <div className={`grid gap-2 ${c}`}>{children}</div>;
}

/** Compact key/value stat row. */
export function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-700/60 py-1.5 text-sm last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="instrument-value text-gray-200">{value}</span>
    </div>
  );
}
