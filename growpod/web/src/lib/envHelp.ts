// Plain-language "what's wrong and how to fix it" copy for an out-of-band
// reading. Pure data + a tiny lookup, so the Environment rail and the Grow
// Console can both surface the SAME guidance when a value goes amber/red — and
// it stays unit-testable (no DOM).
//
// This is help *for an existing reading*, not a new metric: every key here is a
// row that already renders in the env rail / grow console. Direction ("low" vs
// "high") comes from the optimal band edge the value fell outside of.

import { type Band } from "@/lib/envBands";

export type HelpDirection = "low" | "high";

export interface MetricHelp {
  /** One-line "what this reading means" — shown even when in band. */
  what: string;
  /** Concrete fix when the value is below the optimal window. */
  low: string;
  /** Concrete fix when the value is above the optimal window. */
  high: string;
}

/** Keyed by the env-row / console-row `key` (temperature, humidity, vpd, …). */
const HELP: Record<string, MetricHelp> = {
  temperature: {
    what: "Air temperature in the tent. Drives transpiration and growth rate.",
    low: "Too cold — growth stalls. Nudge the heater up toward the ideal window.",
    high: "Too hot — the plant stresses and drinks hard. Cool the tent back down.",
  },
  humidity: {
    what: "Relative humidity. Too dry overworks the leaves; too damp invites mould.",
    low: "Air's too dry — leaves transpire fast. Raise humidity into the ideal band.",
    high: "Air's too damp — mildew and bud-rot risk. Lower humidity into the band.",
  },
  vpd: {
    what: "Vapour-pressure deficit — how hard the plant has to work to transpire.",
    low: "VPD low — sluggish transpiration. Warm the air a touch or drop humidity.",
    high: "VPD high — the plant is water-stressed. Cool down or add some humidity.",
  },
  dli: {
    what: "Daily light integral — total light the canopy banks over a day.",
    low: "Not enough daily light. Raise PPFD or run the light a few hours longer.",
    high: "Too much light energy — bleaching risk. Dial PPFD or the photoperiod back.",
  },
  ppfd: {
    what: "Light intensity hitting the canopy right now.",
    low: "Light's weak — growth is light-limited. Raise the PPFD setpoint.",
    high: "Light's harsh — tip burn / bleaching risk. Lower the PPFD setpoint.",
  },
  co2: {
    what: "CO₂ available for photosynthesis. More fuels faster growth, to a point.",
    low: "CO₂ low — photosynthesis is capped. Raise CO₂ toward the ideal window.",
    high: "CO₂ very high — past the point of gain. Ease it back toward the window.",
  },
  ph: {
    what: "Root-zone pH. The wrong pH locks nutrients out even when they're present.",
    low: "Root zone too acidic — nutrients lock out. Raise pH into the ideal band.",
    high: "Root zone too alkaline — nutrients lock out. Lower pH into the ideal band.",
  },
  water: {
    what: "Reservoir / medium moisture the plant is drawing from.",
    low: "The plant is thirsty. Hit WATER to top the reservoir back up.",
    high: "Overwatered — roots can't breathe. Ease off and let it dry back a little.",
  },
  nutrients: {
    what: "How rich the feed in the root zone is right now.",
    low: "Feed is running low. Hit FEED to bring nutrients back up.",
    high: "Feed too rich — nutrient-burn risk. Flush with plain water and ease off.",
  },
  // Grow Console alias: NUTRIENT PPM is the same root-zone strength reading.
  ppm: {
    what: "Nutrient strength of the feed, in parts per million.",
    low: "PPM under the stage target — light feed. Bump the feed up a notch.",
    high: "PPM over the stage target — burn risk. Dilute / flush toward the target.",
  },
};

/** Look up the help copy for a reading by its row key (case-insensitive). */
export function metricHelp(key: string): MetricHelp | null {
  return HELP[key.toLowerCase()] ?? null;
}

/**
 * Which edge of the optimal window the value fell outside, or null when it's in
 * band (or unknown). Mirrors the direction logic used by the status aggregator.
 */
export function bandDirection(value: number | null, band: Band): HelpDirection | null {
  if (value == null) return null;
  const [lo, hi] = band.optimal;
  if (value < lo) return "low";
  if (value > hi) return "high";
  return null;
}

/** The directional fix line for a reading, or null when nothing's wrong. */
export function fixFor(key: string, value: number | null, band: Band): string | null {
  const dir = bandDirection(value, band);
  if (!dir) return null;
  const help = metricHelp(key);
  return help ? help[dir] : null;
}
