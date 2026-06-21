"use client";

import { useState } from "react";
import {
  ENV_GROUP_ORDER,
  ENV_ROWS,
  bandPct,
  bandSeverity,
  optimalMidpoint,
  optimalSpanPct,
  type EnvRowDef,
} from "@/lib/envBands";
import { fixFor, metricHelp } from "@/lib/envHelp";
import { LEVEL_LABEL, nutrientMix, type Level } from "@/lib/nutrientMix";
import { STAGE_INFO } from "@/lib/stageInfo";
import { nudge } from "@/lib/slider";
import type { GrowthStage } from "@/lib/types";
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
            <div className="flex-1">
              <input
                type="range"
                min={rLo}
                max={rHi}
                step={step}
                value={value}
                disabled={disabled}
                aria-label={def.label}
                onChange={(e) => onChange(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {/* "ideal zone" guide rail: the green segment is the optimal window
                  on the same scale as the slider, with a tick at the current
                  setpoint — so you can see where to aim without reading numbers. */}
              <div className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-ink-700" aria-hidden>
                <div
                  className="absolute inset-y-0 bg-grow-500/40"
                  style={{
                    left: `${optimalSpanPct(def.band).left}%`,
                    right: `${100 - optimalSpanPct(def.band).right}%`,
                  }}
                />
                <div
                  className={`absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded ${sev === 0 ? "bg-cyan-200" : sev === 1 ? "bg-amber-300" : "bg-red-400"}`}
                  style={{ left: `${pct}%` }}
                />
              </div>
            </div>
            {/* Snap straight to the middle of the ideal window (one tap). */}
            <button
              type="button"
              aria-label={`Set ${def.label} to ideal`}
              title="Snap to ideal"
              disabled={disabled}
              onClick={() => onChange(optimalMidpoint(def.band, step))}
              className="flex h-5 w-5 flex-none items-center justify-center rounded border border-grow-700/50 bg-[#0a1722] text-[11px] leading-none text-grow-300/80 hover:border-grow-500/60 hover:text-grow-200 disabled:opacity-40"
            >
              ⌖
            </button>
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

/** One macro row: label + a 3-segment fill showing how hard to feed it. */
function MixBar({ label, level }: { label: string; level: Level }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[104px] flex-none font-mono text-[9px] tracking-wide text-cyan-200/55">
        {label}
      </span>
      <div className="flex flex-1 gap-0.5" aria-hidden>
        {[1, 2, 3].map((seg) => (
          <span
            key={seg}
            className={`h-1.5 flex-1 rounded-sm ${seg <= level ? "bg-grow-500/80" : "bg-ink-700"}`}
          />
        ))}
      </div>
      <span className="w-[28px] flex-none text-right font-mono text-[9px] text-cyan-200/50">
        {LEVEL_LABEL[level]}
      </span>
    </div>
  );
}

/** Expandable feed-composition (N-P-K + micros) recommended for the plant's
 *  current growth stage — the micronutrient detail inside the Nutrients control. */
function NutrientMixPanel({ stage }: { stage: GrowthStage }) {
  const [open, setOpen] = useState(false);
  const mix = nutrientMix(stage);
  const stageLabel = STAGE_INFO[stage]?.label ?? stage;

  return (
    <div className="rounded-lg border border-[#13283a] bg-[#0a1722] px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <span className={`text-[9px] text-cyan-200/45 ${open ? "rotate-90" : ""} transition-transform`} aria-hidden>
          ▸
        </span>
        <span className="instrument-label text-[9px] text-cyan-200/50">
          FEED MIX · {stageLabel}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          <MixBar label="N · Nitrogen" level={mix.npk.n} />
          <MixBar label="P · Phosphorus" level={mix.npk.p} />
          <MixBar label="K · Potassium" level={mix.npk.k} />
          <p className="pt-0.5 text-[9px] leading-snug text-cyan-200/55">{mix.micros}</p>
          <p className="text-[9px] italic leading-snug text-cyan-200/40">{mix.note}</p>
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
      <div className="space-y-2.5">
        {ENV_GROUP_ORDER.map((group) => {
          const rows = ENV_ROWS.filter((def) => def.group === group);
          if (rows.length === 0) return null;
          return (
            <div key={group} className="space-y-1.5">
              <h4 className="instrument-label text-[9px] text-cyan-200/40">{group}</h4>
              {rows.map((def) => {
                const { value, editable, step } = valueFor(def);
                return (
                  <div key={def.key} className="space-y-1.5">
                    <EnvRow
                      def={def}
                      value={value}
                      editable={editable}
                      step={step}
                      disabled={disabled}
                      onChange={(v) => def.source.kind === "setpoint" && onSlide(def.source.field, v)}
                    />
                    {def.key === "nutrients" && <NutrientMixPanel stage={plant.growth_stage} />}
                  </div>
                );
              })}
            </div>
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
