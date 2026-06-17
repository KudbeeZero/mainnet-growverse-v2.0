// ============================================================================
// FRONTIER — Clone Room :: Harvest service (Manual Sections 5, 8.3 & 9)
// ----------------------------------------------------------------------------
// The end of a grow's life: the "snapshot" the player works toward. Harvesting
//   1. computes the rarity tier from resinProfile + resolved story events +
//      tend count + biome (rarity.ts, Section 5),
//   2. mints a Harvest NFT — the proof-of-play token that records the parent
//      seed, the grow id, the rarity and the player's full story-event journey
//      (Section 8.3), and
//   3. atomically stamps harvestNftId + rarityTier onto the grow and marks it
//      `complete`.
//
// Idempotent / replay-safe (Section 12.1 — "harvest_nft_id is set atomically"):
// a grow that already carries a harvestNftId is returned untouched, and the
// final write is guarded by `harvest_nft_id IS NULL`.
// ============================================================================

import { and, eq, isNull } from "drizzle-orm";
import { db, plantGrows, plantSeeds, storyEvents } from "@workspace/db";
import type { PlantGrow, PlantStage, StoryOutcome } from "@workspace/db";
import { computeRarity, type RarityTier } from "./rarity";
import { isPositiveOutcome } from "./storyService";
import { getChainMintClient, type ChainMintClient } from "../chain/chainMintClient";

/** Stages from which a grow may be harvested (it has reached veg). */
const HARVESTABLE: PlantStage[] = ["veg", "harvest"];

export interface HarvestOptions {
  /** Biome of the parent FRONTIER plot (rarity input). */
  biome?: string | null;
  /** Whether pH was kept in the perfect band (Legendary requirement). */
  perfectPh?: boolean;
}

export interface HarvestResult {
  grow: PlantGrow;
  rarityTier: RarityTier;
  /** The minted Harvest NFT asset id, or null if the chain mint was deferred. */
  harvestNftId: string | null;
  /** True when this call performed the harvest; false if it was already done. */
  minted: boolean;
}

export type HarvestRefusal = "grow_not_found" | "seed_not_found" | "not_ready";

/**
 * Harvest a grow. Returns the harvest result, or a {@link HarvestRefusal}.
 */
export async function harvestPlant(
  growId: string,
  opts: HarvestOptions = {},
  client: ChainMintClient = getChainMintClient(),
): Promise<HarvestResult | HarvestRefusal> {
  const [grow] = await db
    .select()
    .from(plantGrows)
    .where(eq(plantGrows.growId, growId))
    .limit(1);

  if (!grow) return "grow_not_found";

  // Already harvested — idempotent, return the recorded snapshot.
  if (grow.harvestNftId) {
    return {
      grow,
      rarityTier: (grow.rarityTier as RarityTier) ?? "common",
      harvestNftId: grow.harvestNftId,
      minted: false,
    };
  }

  if (!HARVESTABLE.includes(grow.stage as PlantStage)) return "not_ready";

  const [seed] = await db
    .select()
    .from(plantSeeds)
    .where(eq(plantSeeds.seedId, grow.seedId))
    .limit(1);

  if (!seed) return "seed_not_found";

  const events = await db
    .select()
    .from(storyEvents)
    .where(eq(storyEvents.growId, growId));

  const positiveEvents = events.filter((e) =>
    isPositiveOutcome(e.outcome as StoryOutcome | null),
  ).length;
  const hasMutationEvent = events.some((e) => e.eventType === "unexpected_mutation");
  const trichomeWaited = events.some(
    (e) => e.eventType === "perfect_trichome_window" && e.choiceMade === "wait_48h",
  );

  const rarityTier = computeRarity({
    positiveEvents,
    hasMutationEvent,
    tendActions: grow.tendActions ?? 0,
    trichomeWaited,
    perfectPh: opts.perfectPh ?? false,
    biome: opts.biome ?? null,
  });

  // Mint the Harvest NFT (best-effort). A chain failure must not block the
  // harvest record; harvestNftId stays null and can be reconciled later. The
  // asset id is the canonical on-chain reference stamped onto the grow.
  let harvestNftId: string | null = null;
  try {
    const result = await client.mintHarvest({
      growId,
      seedId: seed.seedId,
      parentSeedId: seed.parentSeedId ?? seed.seedId,
      ownerAddress: seed.ownerAddress,
      rarityTier,
      tendActions: grow.tendActions ?? 0,
      parentPlotBiome: opts.biome ?? null,
      storyEvents: events.map((e) => ({
        type: e.eventType,
        choice: e.choiceMade,
        outcome: e.outcome,
      })),
    });
    harvestNftId = String(result.assetId);
  } catch {
    // deferred — record the harvest without the ASA id
  }

  // Atomic completion guarded by harvest_nft_id IS NULL (replay protection).
  const [updated] = await db
    .update(plantGrows)
    .set({
      stage: "complete" as PlantStage,
      rarityTier,
      harvestNftId,
    })
    .where(and(eq(plantGrows.growId, growId), isNull(plantGrows.harvestNftId)))
    .returning();

  // If another request won the race, re-read is unnecessary — return the merge.
  const finalGrow =
    updated ?? { ...grow, stage: "complete" as PlantStage, rarityTier, harvestNftId };

  return { grow: finalGrow, rarityTier, harvestNftId, minted: updated != null };
}
