/**
 * Targeted plant reactions — the data behind the CHAMBER-side visual response
 * to a care action. Where `careFeedbackData.ts` choreographs the burst at the
 * button the player tapped, this maps each action to a reaction ON THE PLANT
 * itself (owner spec: "when the player taps a care button, the plant/chamber
 * should react"): water pulses the root zone blue, feed sends a green pulse up
 * the stem, prune sparkles at the canopy, train draws branch guides, inspect
 * sweeps a scanner line.
 *
 * Pure + framework-free so it's unit-testable. The visual layer
 * (`PlantReactionLayer.tsx`) renders these specs; `CareButtons` (or a page)
 * dispatches them via a window CustomEvent — same decoupling pattern as
 * `boostEngine`'s BOOST_APPLIED_EVENT, so the buttons don't need a ref into
 * whichever plant canvas happens to be on screen.
 */

import type { CareKind } from "./careFeedbackData";

/** Care kinds plus screen-level actions that react on the plant but aren't
 *  server care mutations (inspect = the scanner sweep on arrival). */
export type ReactionKind = CareKind | "inspect";

/** Where on the plant the reaction plays (fractions of the chamber height). */
export type ReactionZone = "roots" | "stem" | "canopy" | "full";

export interface CareReaction {
  zone: ReactionZone;
  /** Motion primitive the visual layer renders for this reaction. */
  motion: "pulse" | "rise" | "sparkle" | "guide" | "sweep" | "shimmer";
  /** rgba() accent the animation is tinted with. */
  tint: string;
  /** Total play time (ms) — the layer unmounts the reaction after this. */
  dur: number;
  /** Screen-reader / intent label. */
  label: string;
}

export const CARE_REACTION_EVENT = "gpe:care-reaction";

export const CARE_REACTIONS: Record<ReactionKind, CareReaction> = {
  // Owner spec, verbatim mapping:
  water: { zone: "roots", motion: "pulse", tint: "rgba(56,189,248,0.55)", dur: 1400, label: "Water reaching the root zone" },
  feed: { zone: "stem", motion: "rise", tint: "rgba(118,192,36,0.5)", dur: 1500, label: "Nutrients rising through the stem" },
  prune: { zone: "canopy", motion: "sparkle", tint: "rgba(190,242,255,0.85)", dur: 1300, label: "Canopy trimmed" },
  train: { zone: "canopy", motion: "guide", tint: "rgba(125,211,252,0.8)", dur: 1600, label: "Branches guided outward" },
  inspect: { zone: "full", motion: "sweep", tint: "rgba(56,189,248,0.65)", dur: 1500, label: "Scanning plant" },
  // Sensible extensions in the same voice (not owner-specified, kept subtle):
  treatPests: { zone: "canopy", motion: "shimmer", tint: "rgba(251,146,60,0.4)", dur: 1400, label: "Pest treatment misting the canopy" },
  treatDisease: { zone: "canopy", motion: "shimmer", tint: "rgba(196,181,253,0.4)", dur: 1400, label: "Disease treatment misting the canopy" },
  boost: { zone: "full", motion: "shimmer", tint: "rgba(253,224,71,0.35)", dur: 1200, label: "Boost energizing the plant" },
  harvest: { zone: "full", motion: "shimmer", tint: "rgba(118,192,36,0.4)", dur: 1600, label: "Harvesting" },
};

/**
 * Fire a plant reaction. Any mounted `PlantReactionLayer` (chamber stage,
 * plant-detail render card) picks it up and plays the mapped animation.
 * No-op during SSR.
 */
export function dispatchCareReaction(kind: ReactionKind): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReactionKind>(CARE_REACTION_EVENT, { detail: kind }));
}
