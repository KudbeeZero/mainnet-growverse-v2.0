"use client";

import { useState } from "react";
import { ENV_ROWS, bandPct, bandSeverity, type EnvRowDef } from "@/lib/envBands";
import { fixFor, metricHelp } from "@/lib/envHelp";
import { nudge } from "@/lib/slider";
import { envStatus, STATUS_STYLES } from "@/lib/podStatus";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import type { Environment } from "@/lib/api";
import type { PlantState, Pod } from "@/lib/types";

const VAL_COLOR = ["text-white", "text-amber-300", "text-red-300"] as const;

function EnvRow({
  def,
  value,
  editable,
  step,
  disabled,
  onChange,
}: {
  def: EnvRowDef;
  value: number | null;
  editable: boolean;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const [optLo, optHi] = def.band.optimal;
  const [rLo, rHi] = def.band.range;
  const sev = value == null ? 0 : bandSeverity(value, def.band);
  const pct = value == null ? 0 : bandPct(value, def.band);

  // When a reading is out of band, offer one-tap guidance: what's wrong + the
  // concrete fix for THIS direction (too low vs too high).
  const [helpOpen, setHelpOpen] = useState(false);
  const fix = fixFor(def.key, value, def.band);
  const help = metricHelp(def.key);
  const canHelp = sev > 0 && !!fix;

  return (
    <div className="rounded-lg border border-[#15303f] bg-[#0b1b27] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-[84px] flex-none font-mono text-[10px] tracking-[0.05em] text-cyan-200/60">
          {def.label}
        </span>
        {editable && value != null ? (
          <>
            <input
              type="range"
              min={rLo}
              max={rHi}
              step={step}
              value={value}
              disabled={disabled}
              aria-label={def.label}
              onChange={(e) => onChange(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {/* ± micro-nudge for exact dial-in (one step per tap). */}
            <button
              type="button"
              aria-label={`Decrease ${def.label}`}
              disabled={disabled}
              onClick={() => onChange(nudge(value, -1, step, rLo, rHi))}
              className="flex h-5 w-5 flex-none items-center justify-center rounded border border-[#15303f] bg-[#0a1722] font-mono text-xs leading-none text-cyan-200/60 hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-40"
            >
              −
            </button>
            <button
              type="button"
              aria-label={`Increase ${def.label}`}
              disabled={disabled}
              onClick={() => onChange(nudge(value, 1, step, rLo, rHi))}
              className="flex h-5 w-5 flex-none items-center justify-center rounded border border-[#15303f] bg-[#0a1722] font-mono text-xs leading-none text-cyan-200/60 hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-40"
            >
              +
            </button>
          </>
        ) : (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden>
            <div
              className={`h-full rounded-full transition-all duration-500 ${sev === 0 ? "bg-grow-500" : sev === 1 ? "bg-amber-400" : "bg-red-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <span className={`w-[60px] flex-none text-right font-mono text-xs font-bold ${VAL_COLOR[sev]}`}>
          {value == null ? "—" : value.toFixed(def.digits)}
          {def.band.unit && <span className="ml-0.5 text-[9px] text-cyan-200/50">{def.band.unit}</span>}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-end gap-2 pl-[92px]">
        {canHelp && (
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            aria-expanded={helpOpen}
            aria-label={`Help with ${def.label}`}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-px font-mono text-[8px] font-bold tracking-wide transition-colors ${
              sev === 1
                ? "border-amber-400/40 text-amber-300/90 hover:bg-amber-400/10"
                : "border-red-500/40 text-red-300/90 hover:bg-red-500/10"
            }`}
          >
            <span aria-hidden>{helpOpen ? "▾" : "?"}</span> NEED HELP
          </button>
        )}
        <span className="font-mono text-[8px] tracking-wide text-cyan-200/35">
          ideal {optLo}–{optHi}
        </span>
      </div>

      {canHelp && helpOpen && (
        <div
          className={`mt-1.5 rounded-md border px-2 py-1.5 text-[10px] leading-snug ${
            sev === 1
              ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-100/90"
              : "border-red-500/25 bg-red-500/[0.06] text-red-100/90"
          }`}
        >
          <p className="font-semibold">{fix}</p>
          {help && <p className="mt-1 text-cyan-200/45">{help.what}</p>}
        </div>
      )}
    </div>
  );
}

/** Right "ENVIRONMENT & WEATHER" rail: editable setpoints + read-only readouts. */
export function EnvironmentRail({
  climate,
  plant,
  pod,
  disabled,
  onSlide,
}: {
  climate: Environment;
  plant: PlantState;
  pod: Pod | undefined;
  disabled: boolean;
  onSlide: (field: keyof Environment, value: number) => void;
}) {
  const status = envStatus(pod, plant);

  function valueFor(def: EnvRowDef): { value: number | null; editable: boolean; step: number } {
    if (def.source.kind === "setpoint") {
      return { value: climate[def.source.field], editable: true, step: def.source.step };
    }
    if (def.source.kind === "metric") {
      return { value: plant.metrics?.[def.source.field] ?? null, editable: false, step: 1 };
    }
    return { value: plant[def.source.field], editable: false, step: 1 };
  }

  return (
    <CollapsiblePanel
      title="🌡 ENVIRONMENT"
      action={
        <span
          className="rounded border border-ink-700 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-gray-500"
          title="Automatic climate control — coming soon"
        >
          AUTO {pod?.auto_water || pod?.auto_feed ? "ON" : "OFF"}
        </span>
      }
    >
      <div className="space-y-1.5">
        {ENV_ROWS.map((def) => {
          const { value, editable, step } = valueFor(def);
          return (
            <EnvRow
              key={def.key}
              def={def}
              value={value}
              editable={editable}
              step={step}
              disabled={disabled}
              onChange={(v) => def.source.kind === "setpoint" && onSlide(def.source.field, v)}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink-700 pt-2">
        <span className="instrument-label text-[10px]">ENVIRONMENT STATUS</span>
        <span className={`text-xs font-bold ${STATUS_STYLES[status]}`}>{status}</span>
      </div>
    </CollapsiblePanel>
  );
}
