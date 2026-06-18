// University Grow Console — pure, unit-testable logic.
//
// Turns a plant's live `/state` metrics (+ its pod) into the rows the read-only
// Grow Console renders: current value, the stage's optimal window, and an
// in-band / out-of-band severity. No DOM, so it can be tested directly.
//
// Single source of truth for the optimal windows is `@/lib/envBands` (BANDS +
// bandSeverity). The one exception is NUTRIENT PPM, whose optimal window is the
// plant's *current growth stage* target band, served live on `/state`
// (metrics.stage_targets); we fall back to the stage-agnostic BANDS.nutrient_ppm
// window only for the display range.

import { BANDS, bandSeverity, type Band } from "@/lib/envBands";
import type { PlantState, Pod } from "@/lib/types";

export interface ConsoleRow {
  key: string;
  label: string;
  /** Current reading, or null when the backend hasn't supplied it yet. */
  value: number | null;
  /** Band used for the optimal window + severity. */
  band: Band;
  /** Decimal places to show. */
  digits: number;
  /** 0 in-band, 1 out, 2 far-out; null when the value or its target is unknown. */
  severity: 0 | 1 | 2 | null;
  /** Honest empty-state note (e.g. no PPM target for the current stage). */
  note?: string;
}

function metricRow(
  key: string,
  label: string,
  value: number | null | undefined,
  band: Band,
  digits: number,
): ConsoleRow {
  const v = value ?? null;
  return {
    key,
    label,
    value: v,
    band,
    digits,
    severity: v == null ? null : bandSeverity(v, band),
  };
}

/**
 * Build the Grow Console rows for a plant and its pod. Pure function: deriving
 * the in-band/out-of-band state here (rather than in the component) keeps the
 * logic unit-testable.
 */
export function growConsoleRows(plant: PlantState, pod?: Pod | null): ConsoleRow[] {
  const m = plant.metrics;
  const targets = m?.stage_targets ?? null;

  // PPM uses the plant's live per-stage target window when the stage has one;
  // outside the fed stages (seed / germination / harvest) there is no target,
  // so we show the value with an honest "no target" note and no in/out verdict.
  const ppmBand: Band = targets
    ? { optimal: targets, range: BANDS.nutrient_ppm.range, unit: BANDS.nutrient_ppm.unit }
    : BANDS.nutrient_ppm;
  const ppm = m?.nutrient_ppm ?? null;

  return [
    {
      key: "ppm",
      label: "NUTRIENT PPM",
      value: ppm,
      band: ppmBand,
      digits: 0,
      severity: ppm == null || !targets ? null : bandSeverity(ppm, ppmBand),
      note: !targets ? "No PPM target for this stage" : undefined,
    },
    metricRow("vpd", "VPD", m?.vpd_kpa, BANDS.vpd_kpa, 2),
    metricRow("dli", "DLI", m?.dli_mol, BANDS.dli_mol, 1),
    metricRow("ppfd", "PPFD", m?.ppfd, BANDS.light_intensity, 0),
    metricRow("ph", "pH", pod?.ph_level ?? null, BANDS.ph_level, 1),
  ];
}

/** Whether the console has any live metrics to show yet (drives the loading state). */
export function hasMetrics(plant: PlantState): boolean {
  return Boolean(plant.metrics);
}
