// ============================================================================
// FRONTIER — Clone Room :: Clone-cut service (Manual Sections 2.2 & 9)
// ----------------------------------------------------------------------------
// Cut a clone from a growing plant. A clone is a Gen N+1 seed whose genetics
// are derived from the parent plant's traits (±5%, see cloneGen.ts) rather than
// from on-chain entropy. Unlike a Gen 0 seed, the Clone NFT is minted
// IMMEDIATELY on cut, and the clone enters its own grow at the `seedling` stage.
//
// Flow (Section 2.2):
//   1. Verify the grow can cut a clone this stage (canCutClone) and claim the
//      cut atomically (markCloneCut) — enforces "one clone cut per stage".
//   2. Derive clone traits from the parent seed's genetics (±5%).
//   3. Persist a new plant_seeds row: generation+1, parentSeedId = parent seed.
//   4. Mint the Clone NFT on-chain immediately (best-effort, idempotent).
//   5. Create the clone's own plant_grows row at `seedling`.
// ============================================================================

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, plantGrows, plantSeeds } from "@workspace/db";
import type { PlantGrow, PlantSeed, PlantStage, SeedTraits } from "@workspace/db";
import { canCutClone, getGrowTraits, markCloneCut } from "./plantService";
import { deriveCloneTraits } from "../chain/cloneGen";
import { seededRandom } from "./storyEngine";
import { mintSeedOnChain } from "../chain/seedService";

export interface CloneCutResult {
  cloneSeed: PlantSeed;
  cloneGrow: PlantGrow;
}

/** Why a clone cut was refused, or null when it is allowed. */
export type CloneRefusal = "grow_not_found" | "seed_not_found" | "not_eligible";

/**
 * Cut a clone from `growId`. Returns the new clone's seed + grow on success, or
 * a {@link CloneRefusal} string when the cut is not allowed.
 *
 * `rng` is injectable so the ±5% derivation is reproducible in tests; it
 * defaults to a draw seeded by the new clone's id (deterministic per clone).
 */
export async function cutClone(
  growId: string,
  rng?: () => number,
): Promise<CloneCutResult | CloneRefusal> {
  const [grow] = await db
    .select()
    .from(plantGrows)
    .where(eq(plantGrows.growId, growId))
    .limit(1);

  if (!grow) return "grow_not_found";
  if (!canCutClone(grow)) return "not_eligible";

  // Need the parent seed for its genetics, lineage and ownership.
  const [parentSeed] = await db
    .select()
    .from(plantSeeds)
    .where(eq(plantSeeds.seedId, grow.seedId))
    .limit(1);

  if (!parentSeed) return "seed_not_found";

  // Claim the cut for this stage atomically — loses the race => already cut.
  const claimed = await markCloneCut(growId);
  if (!claimed) return "not_eligible";

  const cloneSeedId = randomUUID();
  // Deterministic-per-clone RNG when the caller does not supply one.
  const draw =
    rng ?? seededRandom(hashStringToInt(cloneSeedId));

  const parentTraits = parentSeed.traits as SeedTraits;
  const traits: SeedTraits = {
    ...deriveCloneTraits(parentTraits, draw),
    parentSeedId: parentSeed.seedId,
  };

  const now = Date.now();

  const [cloneSeed] = await db
    .insert(plantSeeds)
    .values({
      seedId: cloneSeedId,
      asaId: null, // minted immediately below
      ownerAddress: parentSeed.ownerAddress,
      ownerPlayerId: parentSeed.ownerPlayerId,
      traits,
      mintTxId: null,
      mintedAt: null,
      parentSeedId: parentSeed.seedId,
      generationNum: (parentSeed.generationNum ?? 0) + 1,
      nonce: randomUUID(), // fresh entropy column (traits are parent-derived)
      blockHash: parentSeed.blockHash, // carry provenance from the parent
    })
    .returning();

  // Section 2.2: "Clone NFT is minted immediately on cut." Best-effort — a
  // chain failure must not lose the clone; the DB row is authoritative and the
  // ASA can be minted on a later reconcile (mintSeedOnChain is idempotent).
  let mintedClone = cloneSeed;
  try {
    mintedClone = (await mintSeedOnChain(cloneSeedId)) ?? cloneSeed;
  } catch {
    // swallow — deferred mint; row already persisted
  }

  // The clone enters its own grow at `seedling` (Section 2.2).
  const [cloneGrow] = await db
    .insert(plantGrows)
    .values({
      growId: randomUUID(),
      seedId: cloneSeedId,
      ownerPlayerId: parentSeed.ownerPlayerId ?? grow.ownerPlayerId,
      stage: "seedling" as PlantStage,
      startedAt: now,
      stageAt: now,
      stageEvents: [],
      tendActions: 0,
      cloneCut: false,
      parentPlotId: grow.parentPlotId ?? null,
    })
    .returning();

  return { cloneSeed: mintedClone, cloneGrow };
}

/** Stable 32-bit hash of a string (for seeding the per-clone RNG). */
function hashStringToInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
