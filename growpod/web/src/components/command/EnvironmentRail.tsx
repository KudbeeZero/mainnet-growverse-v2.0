"use client";

import { ENV_ROWS, bandPct, bandSeverity, type EnvRowDef } from "@/lib/envBands";
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

  return (
    <div className="rounded-lg border border-[#15303f] bg-[#0b1b27] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="w-[84px] flex-none font-mono text-[10px] tracking-[0.05em] text-cyan-200/60">
          {def.label}
        </span>
        {editable && value != null ? (
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
      <div className="mt-0.5 pl-[92px] text-right font-mono text-[8px] tracking-wide text-cyan-200/35">
        ideal {optLo}–{optHi}
      </div>
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
