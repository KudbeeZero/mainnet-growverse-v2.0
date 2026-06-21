// Environment optimal bands + device ranges for the Command Center env rail.
//
// Single source of truth mirroring the backend tuning (`data/balance.yaml`
// simulation block) and the chamber page's existing `SLIDERS` optimal windows,
// so the environment rail and the pod-status aggregator can never disagree about
// what "in band" means. Pure data — no DOM, unit-testable.

import type { Environment } from "@/lib/api";

export interface Band {
  /** No-penalty optimal window [min, max]. */
  optimal: readonly [number, number];
  /** Device / display range for the slider or read-only bar. */
  range: readonly [number, number];
  unit: string;
}

export const BANDS = {
  // Editable pod setpoints (commit to the backend).
  temperature: { optimal: [20, 28], range: [10, 40], unit: "°C" },
  humidity: { optimal: [40, 60], range: [10, 95], unit: "%" },
  co2_level: { optimal: [800, 1500], range: [400, 1500], unit: "ppm" },
  light_intensity: { optimal: [300, 900], range: [0, 1000], unit: "" }, // PPFD setpoint
  ph_level: { optimal: [6, 7], range: [4, 9], unit: "" },
  // Derived read-only metrics + plant vitals.
  vpd_kpa: { optimal: [0.8, 1.6], range: [0, 3], unit: "kPa" },
  dli_mol: { optimal: [20, 45], range: [0, 65], unit: "mol/m²" },
  water_level: { optimal: [50, 100], range: [0, 100], unit: "%" },
  nutrient_level: { optimal: [50, 100], range: [0, 100], unit: "%" },
  // Display-only nutrient PPM (mirrors balance.yaml `nutrient.ppm_display_scale`
  // and `stage_targets`). The `optimal` here is a stage-agnostic fallback that
  // spans the seedling→flowering targets; the Grow Console overrides it with the
  // plant's live per-stage window from `/state`.
  nutrient_ppm: { optimal: [400, 1000], range: [0, 1200], unit: "ppm" },
} as const satisfies Record<string, Band>;

export type EnvSource =
  /** Editable pod setpoint — drives a slider and commits via setEnvironment. */
  | { kind: "setpoint"; field: keyof Environment; step: number }
  /** Read-only derived metric off plant.metrics. */
  | { kind: "metric"; field: "vpd_kpa" | "dli_mol" }
  /** Read-only plant vital (driven by WATER / FEED actions). */
  | { kind: "vital"; field: "water_level" | "nutrient_level" };

/** Which sub-section of the env rail a row lives under. */
export type EnvGroup = "Climate" | "Light" | "Root Zone";

/** Display order of the env-rail sub-sections. */
export const ENV_GROUP_ORDER: EnvGroup[] = ["Climate", "Light", "Root Zone"];

export interface EnvRowDef {
  key: string;
  label: string;
  group: EnvGroup;
  band: Band;
  source: EnvSource;
  /** Decimal places to show for the value. */
  digits: number;
}

/** Row order for the ENVIRONMENT & WEATHER rail (mirrors the dashboard mockup),
 *  organised into Climate · Light · Root Zone sub-sections. */
export const ENV_ROWS: EnvRowDef[] = [
  { key: "temperature", label: "TEMPERATURE", group: "Climate", band: BANDS.temperature, source: { kind: "setpoint", field: "temperature", step: 0.1 }, digits: 1 },
  { key: "humidity", label: "HUMIDITY", group: "Climate", band: BANDS.humidity, source: { kind: "setpoint", field: "humidity", step: 0.5 }, digits: 1 },
  { key: "vpd", label: "VPD", group: "Climate", band: BANDS.vpd_kpa, source: { kind: "metric", field: "vpd_kpa" }, digits: 2 },
  { key: "co2", label: "CO₂", group: "Climate", band: BANDS.co2_level, source: { kind: "setpoint", field: "co2_level", step: 5 }, digits: 0 },
  { key: "dli", label: "DLI", group: "Light", band: BANDS.dli_mol, source: { kind: "metric", field: "dli_mol" }, digits: 1 },
  { key: "ppfd", label: "PPFD", group: "Light", band: BANDS.light_intensity, source: { kind: "setpoint", field: "light_intensity", step: 5 }, digits: 0 },
  { key: "ph", label: "pH", group: "Root Zone", band: BANDS.ph_level, source: { kind: "setpoint", field: "ph_level", step: 0.05 }, digits: 2 },
  { key: "water", label: "WATER LEVEL", group: "Root Zone", band: BANDS.water_level, source: { kind: "vital", field: "water_level" }, digits: 0 },
  { key: "nutrients", label: "NUTRIENTS", group: "Root Zone", band: BANDS.nutrient_level, source: { kind: "vital", field: "nutrient_level" }, digits: 0 },
];

/** 0 = in band, 1 = out of band, 2 = far out (beyond half a band-span past the edge). */
export function bandSeverity(value: number, band: Band): 0 | 1 | 2 {
  const [lo, hi] = band.optimal;
  if (value >= lo && value <= hi) return 0;
  const span = Math.max(1e-6, hi - lo);
  const dist = value < lo ? lo - value : value - hi;
  return dist > span * 0.5 ? 2 : 1;
}

/** Position of a value within its display range, as a 0..100 percentage. */
export function bandPct(value: number, band: Band): number {
  const [lo, hi] = band.range;
  return Math.max(0, Math.min(100, ((value - lo) / Math.max(1e-6, hi - lo)) * 100));
}

/** The optimal window's left/right edges as 0..100 percentages of the device
 *  range — used to paint the "ideal zone" marker on a setpoint slider. */
export function optimalSpanPct(band: Band): { left: number; right: number } {
  const [lo, hi] = band.optimal;
  return { left: bandPct(lo, band), right: bandPct(hi, band) };
}

/** Mid-point of the optimal window, snapped to the slider step and clamped to
 *  the device range — the target a "snap to ideal" control jumps to. */
export function optimalMidpoint(band: Band, step: number): number {
  const [lo, hi] = band.optimal;
  const [rLo, rHi] = band.range;
  const snapped = Math.round((lo + hi) / 2 / step) * step;
  const clamped = Math.min(rHi, Math.max(rLo, snapped));
  // Kill floating-point dust from the step division (e.g. 0.05 pH steps).
  return Number(clamped.toFixed(4));
}
