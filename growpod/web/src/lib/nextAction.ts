// "Next best action" — a pure recommender that reads a plant's live vitals,
// condition flags, and harvest readiness and names the single most useful thing
// to do right now. Pure + unit-tested; the Command Center surfaces it as a hint
// chip and the care bar highlights the matching button. No backend call.

import type { PlantState } from "@/lib/types";

export type ActionKind = "water" | "feed" | "ease_water" | "flush" | "inspect" | "harvest";
export type Urgency = "low" | "med" | "high";

export interface NextAction {
  kind: ActionKind;
  /** Short imperative label, e.g. "Water now". */
  label: string;
  /** Why — one plain-language clause. */
  reason: string;
  urgency: Urgency;
}

const STAGES_NO_FEED = new Set(["seed", "germination"]);

/**
 * The top recommended action, or null when the plant is fine / nothing to do
 * (dead, harvested, or healthy and well-stocked). Priority: harvest-ready →
 * acute condition flags → low vitals.
 */
export function nextAction(plant: PlantState): NextAction | null {
  if (!plant.is_alive || plant.harvested) return null;

  if (plant.forecast?.is_harvest_ready) {
    return { kind: "harvest", label: "Harvest now", reason: "Trichomes are ripe.", urgency: "high" };
  }

  // Acute conditions outrank routine vitals.
  const flags = plant.condition_flags ?? [];
  const has = (c: string) => flags.some((f) => f.condition === c);
  if (has("wilting"))
    return { kind: "water", label: "Water now", reason: "It's wilting from thirst.", urgency: "high" };
  if (has("nutrient_burn"))
    return { kind: "flush", label: "Flush", reason: "Nutrient burn — flush with plain water.", urgency: "high" };
  if (has("root_rot") || has("overwatered"))
    return { kind: "ease_water", label: "Ease off water", reason: "Roots are waterlogged — let it dry back.", urgency: "med" };
  if (has("pest_infestation") || has("mildew"))
    return { kind: "inspect", label: "Inspect", reason: "Pest/mildew spotted — take a look.", urgency: "med" };
  if (has("underwatered"))
    return { kind: "water", label: "Water", reason: "Running dry.", urgency: "med" };
  if (has("nutrient_deficient") && !STAGES_NO_FEED.has(plant.growth_stage))
    return { kind: "feed", label: "Feed", reason: "Showing a nutrient deficiency.", urgency: "med" };

  // Routine vitals.
  if (plant.water_level < 30)
    return { kind: "water", label: "Water", reason: `Water at ${Math.round(plant.water_level)}%.`, urgency: "low" };
  if (plant.nutrient_level < 30 && !STAGES_NO_FEED.has(plant.growth_stage))
    return { kind: "feed", label: "Feed", reason: `Nutrients at ${Math.round(plant.nutrient_level)}%.`, urgency: "low" };

  return null;
}

/** Map the recommended action to a care-bar button key (water/feed/inspect), so
 *  the bar can glow the button to press. Null when nothing maps (harvest /
 *  ease-off don't have a single bar button). */
const ACTION_TO_BAR: Partial<Record<ActionKind, string>> = {
  water: "water",
  flush: "water", // flush = run plain water
  feed: "feed",
  inspect: "inspect",
};

export function recommendedActionKey(plant: PlantState): string | null {
  const a = nextAction(plant);
  return a ? (ACTION_TO_BAR[a.kind] ?? null) : null;
}
