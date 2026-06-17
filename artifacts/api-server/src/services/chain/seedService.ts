// ============================================================================
// FRONTIER — Clone Room :: Seed minting service (Manual Section 3 + 6.1)
// ----------------------------------------------------------------------------
// DB-backed seed minting. "Minting" here means: derive genetics off-chain from
// block-hash entropy (free — no transaction) and persist the authoritative
// `plant_seeds` row. The on-chain ASA is created later, when the seed is
// planted (CLONE-10), so most seeds never incur a chain cost.
//
// Pure row assembly lives in seedRecord.ts; this module owns the DB write.
// ============================================================================

import { and, eq, isNull } from "drizzle-orm";
import { db, plantSeeds } from "@workspace/db";
import type { PlantSeed } from "@workspace/db";
import { buildSeedRecord, type MintSeedInput } from "./seedRecord";
import { getChainMintClient, type ChainMintClient } from "./chainMintClient";

/**
 * Mint a seed: derive its genetics and persist the `plant_seeds` row.
 *
 * The chain columns (asaId / mintTxId / mintedAt) are left null; the ASA is
 * minted at plant time (see {@link mintSeedOnChain}). Returns the inserted seed.
 */
export async function mintSeed(input: MintSeedInput): Promise<PlantSeed> {
  const row = buildSeedRecord(input);
  const [inserted] = await db.insert(plantSeeds).values(row).returning();
  return inserted;
}

/**
 * Mint a seed's on-chain ASA (CLONE-10), invoked when the seed is planted.
 *
 * Idempotent: a seed that already carries an `asaId` is returned untouched, and
 * the persist is guarded by `asaId IS NULL` so concurrent plants can't
 * double-mint. The DB row remains the source of truth; the chain mirrors it.
 *
 * Returns the (possibly minted) seed, or null if no such seed exists.
 */
export async function mintSeedOnChain(
  seedId: string,
  client: ChainMintClient = getChainMintClient(),
): Promise<PlantSeed | null> {
  const [seed] = await db
    .select()
    .from(plantSeeds)
    .where(eq(plantSeeds.seedId, seedId))
    .limit(1);

  if (!seed) return null;
  if (seed.asaId != null) return seed; // already minted — idempotent

  const result = await client.mintSeed(seed);

  const [updated] = await db
    .update(plantSeeds)
    .set({
      asaId: result.assetId,
      mintTxId: result.txId,
      mintedAt: Date.now(),
    })
    .where(and(eq(plantSeeds.seedId, seedId), isNull(plantSeeds.asaId)))
    .returning();

  // If another plant won the race, `updated` is undefined — return current row.
  return updated ?? seed;
}
