// FP-3 — the "what do I do next?" brain for a single plant.
//
// Given a plant (and optionally its pod) this resolves the ONE most important
// next action so the UI can surface it as a primary CTA. Pure and side-effect
// free so it can be unit-tested and shared. Thresholds mirror the vitals bars
// (Bar.tsx): resources are low under 50 / critical under 25; pest & disease
// pressure matters past 20 and is critical past 50.

import type { Plant, Pod } from "@/lib/types";

export type PlantActionKind =
  | "harvest"
  | "treatDisease"
  | "treatPests"
  | "water"
  | "feed"
  | "setClimate"
  | "none";

/** How loudly the UI should shout: a pulsing primary, a calm primary, or a quiet status. */
export type ActionUrgency = "critical" | "due" | "calm";

export interface PlantAction {
  kind: PlantActionKind;
  urgency: ActionUrgency;
  emoji: string;
  /** Button text — imperative, e.g. "Water now". */
  label: string;
  /** One-line "why", e.g. "Water is critically low". */
  reason: string;
}

// Thresholds, named so the intent is legible and matches the vitals bars.
const RESOURCE_CRITICAL = 25;
const RESOURCE_LOW = 50;
const THREAT_PRESENT = 20;
const THREAT_CRITICAL = 50;

/**
 * Resolve the single highest-priority action for a plant.
 *
 * Order: terminal states → ripe harvest → health threats (disease, pests) →
 * critical resources (water, nutrients) → climate setup → gentle top-ups →
 * thriving. `pod` is optional; the climate nudge only fires when it is known.
 */
export function nextPlantAction(plant: Plant, pod?: Pick<Pod, "temperature"> | null): PlantAction {
  if (plant.harvested) {
    return { kind: "none", urgency: "calm", emoji: "🏆", label: "Harvested", reason: "Already harvested — nice work." };
  }
  if (!plant.is_alive) {
    return { kind: "none", urgency: "calm", emoji: "🥀", label: "No longer alive", reason: "This plant didn't make it." };
  }

  // The payoff — a ripe plant outranks everything else.
  if (plant.growth_stage === "harvest") {
    return { kind: "harvest", urgency: "critical", emoji: "✂️", label: "Harvest now", reason: "Buds are ripe and ready to cut." };
  }

  // Health threats kill yield — handle worst pressure first.
  if (plant.disease_level > THREAT_PRESENT) {
    return {
      kind: "treatDisease",
      urgency: plant.disease_level > THREAT_CRITICAL ? "critical" : "due",
      emoji: "🧫",
      label: "Treat disease",
      reason: plant.disease_level > THREAT_CRITICAL ? "Disease is spreading fast." : "Disease is taking hold.",
    };
  }
  if (plant.pest_level > THREAT_PRESENT) {
    return {
      kind: "treatPests",
      urgency: plant.pest_level > THREAT_CRITICAL ? "critical" : "due",
      emoji: "🐞",
      label: "Treat pests",
      reason: plant.pest_level > THREAT_CRITICAL ? "Pests are overrunning the plant." : "Pests are moving in.",
    };
  }

  // Critical resources.
  if (plant.water_level < RESOURCE_CRITICAL) {
    return { kind: "water", urgency: "critical", emoji: "💧", label: "Water now", reason: "Water is critically low." };
  }
  if (plant.nutrient_level < RESOURCE_CRITICAL) {
    return { kind: "feed", urgency: "critical", emoji: "🧪", label: "Feed now", reason: "Nutrients are critically low." };
  }

  // Climate not dialled in yet (only when the pod is known).
  if (pod && pod.temperature == null) {
    return { kind: "setClimate", urgency: "due", emoji: "🌡️", label: "Set the climate", reason: "Pod climate isn't dialled in." };
  }

  // Gentle top-ups before anything turns critical.
  if (plant.water_level < RESOURCE_LOW) {
    return { kind: "water", urgency: "due", emoji: "💧", label: "Top up water", reason: "Water is getting low." };
  }
  if (plant.nutrient_level < RESOURCE_LOW) {
    return { kind: "feed", urgency: "due", emoji: "🧪", label: "Feed", reason: "Nutrients are getting low." };
  }

  return { kind: "none", urgency: "calm", emoji: "🌿", label: "Thriving", reason: "All good — growing nicely." };
}
