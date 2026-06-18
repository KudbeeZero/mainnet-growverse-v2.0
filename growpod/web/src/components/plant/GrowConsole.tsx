"use client";

// University Grow Console — a read-only panel that shows the optimal targets for
// the plant's CURRENT growth stage (nutrient PPM, VPD, DLI, PPFD, pH) and whether
// the pod is inside those windows. Derived entirely from the live `/state`
// metrics; it never writes and never feeds back into the simulation.

import { bandPct } from "@/lib/envBands";
import { growConsoleRows, hasMetrics, type ConsoleRow } from "@/components/plant/growConsole";
import type { PlantState, Pod } from "@/lib/types";

const VAL_COLOR = ["text-grow-300", "text-amber-300", "text-red-300"] as const;
const BAR_COLOR = ["bg-grow-500", "bg-amber-400", "bg-red-500"] as const;

function VerdictBadge({ severity }: { severity: ConsoleRow["severity"] }) {
  if (severity == null) {
    return (
      <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-gray-500">
        NO TARGET
      </span>
    );
  }
  const inBand = severity === 0;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.1em] ${
        inBand
          ? "border border-grow-500/40 text-grow-300"
          : severity === 1
            ? "border border-amber-400/40 text-amber-300"
            : "border border-red-500/40 text-red-300"
      }`}
    >
      {inBand ? "IN RANGE" : "OUT OF RANGE"}
    </span>
  );
}

function ConsoleRowView({ row }: { row: ConsoleRow }) {
  const [optLo, optHi] = row.band.optimal;
  const sev = row.severity ?? 0;
  const pct = row.value == null ? 0 : bandPct(row.value, row.band);

  return (
    <div className="rounded-lg border border-[#15303f] bg-[#0b1b27] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-[96px] flex-none font-mono text-[10px] tracking-[0.05em] text-cyan-200/60">
          {row.label}
        </span>
        <span className={`flex-1 text-right font-mono text-sm font-bold ${VAL_COLOR[sev]}`}>
          {row.value == null ? "—" : row.value.toFixed(row.digits)}
          {row.band.unit && (
            <span className="ml-0.5 text-[9px] text-cyan-200/50">{row.band.unit}</span>
          )}
        </span>
        <span className="w-[88px] flex-none text-right">
          <VerdictBadge severity={row.severity} />
        </span>
      </div>
      {/* position-in-range bar */}
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div
          className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[sev]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-right font-mono text-[8px] tracking-wide text-cyan-200/35">
        {row.note ? row.note : `optimal ${optLo}–${optHi}${row.band.unit ? ` ${row.band.unit}` : ""}`}
      </div>
    </div>
  );
}

/** Read-only "GROW CONSOLE" panel — optimal stage targets + in/out-of-band status. */
export function GrowConsole({ plant, pod }: { plant: PlantState; pod?: Pod | undefined }) {
  return (
    <section className="panel flex flex-col rounded-xl p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-cyan-300">🎓 GROW CONSOLE</h3>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-200/50">
          {plant.growth_stage}
        </span>
      </div>
      <p className="mt-1 text-[9px] leading-snug text-cyan-200/40">
        Optimal targets for this stage. Read-only — adjust the pod from the
        Environment rail.
      </p>

      {!hasMetrics(plant) ? (
        <p className="mt-3 py-4 text-center font-mono text-[10px] text-cyan-200/40">
          Waiting for live readouts…
        </p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {growConsoleRows(plant, pod).map((row) => (
            <ConsoleRowView key={row.key} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
