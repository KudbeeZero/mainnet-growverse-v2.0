// ============================================================================
// FRONTIER — Clone Room :: Story-event resolution (Manual Sections 4 & 9)
// ----------------------------------------------------------------------------
// Persist a player's choice for a pending story event. The choice is resolved
// to its outcome (storyEngine.applyOutcome) and written to the append-only
// story_events table. Section 4: "Events must never be reversible. Once a
// choice is made and written to story_events, it is permanent and will appear
// in the Harvest NFT metadata as proof of the player's journey."
// ============================================================================

import { randomUUID } from "node:crypto";
import { db, storyEvents } from "@workspace/db";
import type { StoryEvent } from "@workspace/db";
import { applyOutcome, type StoryEventType } from "./storyEngine";

/** Outcome tags that represent a beneficial / positive resolution. */
const POSITIVE_TAGS = new Set<string>([
  "clone_eligible",
  "mutation_unlocked",
  "growth_up",
  "resin_up",
  "rare_harvest_tier",
  "mutant_clone_minted",
  "fire_phenotype",
  "max_rarity",
  "legendary_chance",
  "growth_plus_48h",
  "growth_restored",
  "resilient",
  "seed_phenotype",
]);

/**
 * Whether a resolved outcome counts as "positive" for rarity purposes
 * (Manual Section 5 — "1+ story events resolved positively").
 */
export function isPositiveOutcome(outcome: {
  rarityMod?: number;
  tag?: string;
} | null | undefined): boolean {
  if (!outcome) return false;
  if ((outcome.rarityMod ?? 0) > 0) return true;
  return outcome.tag !== undefined && POSITIVE_TAGS.has(outcome.tag);
}

/**
 * Resolve a story event for a grow: validate the choice, then append it to
 * story_events. Returns the inserted event, or null if the event type / choice
 * id is unknown (caller maps that to a 400).
 */
export async function resolveStoryEvent(
  growId: string,
  eventType: StoryEventType,
  choiceId: string,
): Promise<StoryEvent | null> {
  const outcome = applyOutcome(eventType, choiceId);
  if (!outcome) return null;

  const [event] = await db
    .insert(storyEvents)
    .values({
      eventId: randomUUID(),
      growId,
      eventType,
      choiceMade: choiceId,
      outcome,
      createdAt: Date.now(),
    })
    .returning();

  return event;
}
