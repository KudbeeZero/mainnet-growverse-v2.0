import type { GrowthStage } from "@/lib/types";

/** The lifecycle order, mirroring the engine's `_STAGE_ORDER`. */
export const STAGE_ORDER: GrowthStage[] = [
  "seed",
  "germination",
  "seedling",
  "vegetative",
  "flowering",
  "late_flower",
  "harvest",
];

/**
 * Per-stage guidance written for a first-time grower: an icon, a short label,
 * and a plain-language "what's happening / what to do" blurb. (Experts get the
 * precise hours + genetics from the forecast numbers in the timeline.)
 */
export const STAGE_INFO: Record<
  GrowthStage,
  { icon: string; label: string; blurb: string }
> = {
  seed: {
    icon: "🌰",
    label: "Seed",
    blurb:
      "The seed is soaking up moisture and getting ready to crack open. Nothing to do yet — just keep the pod warm and humid.",
  },
  germination: {
    icon: "🌱",
    label: "Germination",
    blurb:
      "A tiny root and the first leaves push out. Keep things moist and gentle — go easy on light and skip nutrients for now.",
  },
  seedling: {
    icon: "🍃",
    label: "Seedling",
    blurb:
      "Young and fragile, growing its first true leaves. Light watering, little to no feeding, and plenty of light.",
  },
  vegetative: {
    icon: "🌿",
    label: "Vegetative",
    blurb:
      "Fast, leafy growth — this is where the plant bulks up. Feed it regularly and keep the light strong (≈18h/day).",
  },
  flowering: {
    icon: "🌸",
    label: "Flowering",
    blurb:
      "Buds are forming. How long this takes depends on the strain's genetics. Watch humidity to avoid mildew and ease off the nitrogen.",
  },
  late_flower: {
    icon: "🪻",
    label: "Late Flower",
    blurb:
      "Buds are fattening and trichomes are ambering up — the ripening finish. Ease right off the nutrients (flush), keep humidity low to protect the colas, and watch for harvest readiness.",
  },
  harvest: {
    icon: "✂️",
    label: "Harvest-ready",
    blurb:
      "The plant is mature and ready to harvest. Cut it, then dry and cure to lock in the quality.",
  },
};
