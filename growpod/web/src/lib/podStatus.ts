// Pod / environment status + alerts aggregation for the Command Center.
//
// The backend exposes per-plant condition_flags and the raw environment values
// but no rolled-up "OPTIMAL / WARNING / CRITICAL" verdict — so we compute it here
// from the optimal bands (lib/envBands) and the plant's condition flags
// (lib/conditionVisuals for human copy). Pure + deterministic.

import type { Pod, PlantState } from "@/lib/types";
import { BANDS, bandSeverity, type Band } from "./envBands";
import { CONDITION_VISUALS, SEVERITY_SCALE } from "./conditionVisuals";

export type Status = "OPTIMAL" | "WARNING" | "CRITICAL";

const FROM_SEVERITY: Record<0 | 1 | 2, Status> = {
  0: "OPTIMAL",
  1: "WARNING",
  2: "CRITICAL",
};

const worse = (a: Status, b: Status): Status => {
  const rank: Record<Status, number> = { OPTIMAL: 0, WARNING: 1, CRITICAL: 2 };
  return rank[a] >= rank[b] ? a : b;
};

interface EnvCheck {
  label: string;
  value: number | null;
  band: Band;
  unit: string;
}

function envChecks(pod: Pod | undefined, plant: PlantState): EnvCheck[] {
  const m = plant.metrics;
  return [
    { label: "Temperature", value: pod?.temperature ?? null, band: BANDS.temperature, unit: BANDS.temperature.unit },
    { label: "Humidity", value: pod?.humidity ?? null, band: BANDS.humidity, unit: BANDS.humidity.unit },
    { label: "CO₂", value: pod?.co2_level ?? null, band: BANDS.co2_level, unit: BANDS.co2_level.unit },
    { label: "Light", value: pod?.light_intensity ?? null, band: BANDS.light_intensity, unit: BANDS.light_intensity.unit },
    { label: "pH", value: pod?.ph_level ?? null, band: BANDS.ph_level, unit: BANDS.ph_level.unit },
    { label: "VPD", value: m?.vpd_kpa ?? null, band: BANDS.vpd_kpa, unit: BANDS.vpd_kpa.unit },
    { label: "Water", value: plant.water_level, band: BANDS.water_level, unit: BANDS.water_level.unit },
    { label: "Nutrients", value: plant.nutrient_level, band: BANDS.nutrient_level, unit: BANDS.nutrient_level.unit },
  ];
}

/** Verdict from environment + vitals alone. */
export function envStatus(pod: Pod | undefined, plant: PlantState): Status {
  let sev: 0 | 1 | 2 = 0;
  for (const c of envChecks(pod, plant)) {
    if (c.value == null) continue;
    sev = Math.max(sev, bandSeverity(c.value, c.band)) as 0 | 1 | 2;
  }
  return FROM_SEVERITY[sev];
}

/** Verdict from the plant's condition flags alone. */
export function conditionStatus(plant: PlantState): Status {
  if (!plant.is_alive) return "CRITICAL";
  let s: Status = "OPTIMAL";
  for (const f of plant.condition_flags ?? []) {
    if (f.condition === "healthy") continue;
    const scale = SEVERITY_SCALE[f.severity] ?? 0.4;
    s = worse(s, scale >= 1 ? "CRITICAL" : "WARNING");
  }
  return s;
}

/** Overall pod verdict — the worse of environment and plant condition. */
export function podStatus(pod: Pod | undefined, plant: PlantState): Status {
  return worse(envStatus(pod, plant), conditionStatus(plant));
}

/** Human-readable alert lines for the footer; optimal when nothing is wrong. */
export function alerts(pod: Pod | undefined, plant: PlantState): string[] {
  const out: string[] = [];
  if (!plant.is_alive) out.push("Plant has died.");

  for (const f of plant.condition_flags ?? []) {
    if (f.condition === "healthy") continue;
    out.push(`${CONDITION_VISUALS[f.condition].label} (${f.severity}).`);
  }

  for (const c of envChecks(pod, plant)) {
    if (c.value == null) continue;
    if (bandSeverity(c.value, c.band) === 0) continue;
    const [lo, hi] = c.band.optimal;
    const dir = c.value < lo ? "low" : "high";
    out.push(`${c.label} ${dir} — ${round(c.value)}${c.unit} (ideal ${lo}–${hi}${c.unit}).`);
  }

  return out.length ? out : ["Environment is optimal."];
}

function round(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export const STATUS_STYLES: Record<Status, string> = {
  OPTIMAL: "text-grow-300",
  WARNING: "text-amber-300",
  CRITICAL: "text-red-300",
};
