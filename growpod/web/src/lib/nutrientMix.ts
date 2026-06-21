// Recommended feed composition for the plant's CURRENT growth stage — the
// micronutrient detail that expands inside the Nutrients control on the env
// rail. This is *guidance* (what to feed at this stage), derived from the
// growth stage alone, not live plant state — so it stays a pure, unit-testable
// lookup and never pretends to read root-zone chemistry the backend doesn't
// model.
//
// The N-P-K emphasis follows standard cannabis nutrition: nitrogen-forward in
// veg, phosphorus/potassium-forward in bloom, flushed to plain water at the
// finish.

import type { GrowthStage } from "@/lib/types";

/** Relative emphasis of a nutrient at a stage: 0 none → 3 high. */
export type Level = 0 | 1 | 2 | 3;

export const LEVEL_LABEL: Record<Level, string> = {
  0: "—",
  1: "low",
  2: "med",
  3: "high",
};

export interface NutrientMix {
  /** Macro emphasis for Nitrogen / Phosphorus / Potassium. */
  npk: { n: Level; p: Level; k: Level };
  /** Secondary + micronutrient guidance (Cal-Mag, trace, flush…). */
  micros: string;
  /** Plain-language headline for the stage's feed. */
  note: string;
}

const MIX: Record<GrowthStage, NutrientMix> = {
  seed: {
    npk: { n: 0, p: 0, k: 0 },
    micros: "Plain water only — no Cal-Mag, no nutrients.",
    note: "Seeds live off their own reserves. Don't feed yet.",
  },
  germination: {
    npk: { n: 0, p: 0, k: 0 },
    micros: "Plain water; a trace of Cal-Mag at most.",
    note: "Barely feeding — keep it to plain water.",
  },
  seedling: {
    npk: { n: 1, p: 1, k: 1 },
    micros: "Quarter-strength Cal-Mag to set up healthy roots.",
    note: "Light, gentle feed — about quarter strength.",
  },
  vegetative: {
    npk: { n: 3, p: 2, k: 2 },
    micros: "Cal-Mag + trace micros to fuel fast leaf growth.",
    note: "Nitrogen-forward feed — this is the bulk-up stage.",
  },
  flowering: {
    npk: { n: 1, p: 3, k: 3 },
    micros: "Keep Cal-Mag up; ease nitrogen down as buds set.",
    note: "Bloom feed — drop nitrogen, push phosphorus & potassium.",
  },
  late_flower: {
    npk: { n: 0, p: 2, k: 2 },
    micros: "Mostly flushing — light P-K only, then plain water.",
    note: "Ripening finish — flush down to a clean, smooth harvest.",
  },
  harvest: {
    npk: { n: 0, p: 0, k: 0 },
    micros: "Plain-water flush complete.",
    note: "Flushed and done — no feeding.",
  },
};

/** The recommended feed mix for a growth stage. */
export function nutrientMix(stage: GrowthStage): NutrientMix {
  return MIX[stage] ?? MIX.seedling;
}
