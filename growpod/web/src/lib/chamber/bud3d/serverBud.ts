// Map the server's TrichomeResinGland telemetry → the 3D bud's frost params, so
// the bud's frostiness + clear→cloudy→amber maturity match the harvest-window
// the 🔬 readout shows (server truth) instead of the client-side dev prediction.
//
// Returns null while previewing a scrubbed grow-day, or when telemetry is absent
// / inactive (pre-flower), so the caller falls back to the client `dev.*` values.
// Pure + unit-testable.

import type { TrichomeTelemetry } from "@/lib/types";

export interface BudServerParams {
  /** 0..1 ripeness for BudGL (drives the frost maturity colours). */
  ripe: number;
  /** 0..1 frost amount for BudGL (× dna.trichomeDensity). */
  trich: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function budParamsFromTrichomes(
  t: TrichomeTelemetry | undefined,
  previewing: boolean,
): BudServerParams | null {
  if (previewing || !t || !t.active) return null;
  // Ripeness = the matured (cloudy + amber) share of the gland population.
  return {
    ripe: clamp01((t.cloudy_pct + t.amber_pct) / 100),
    trich: clamp01(t.density),
  };
}
