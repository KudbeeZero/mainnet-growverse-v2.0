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

import { db, plantSeeds } from "@workspace/db";
import type { PlantSeed } from "@workspace/db";
import { buildSeedRecord, type MintSeedInput } from "./seedRecord";

/**
 * Mint a seed: derive its genetics and persist the `plant_seeds` row.
 *
 * The chain columns (asaId / mintTxId / mintedAt) are left null; the ASA is
 * minted at plant time. Returns the inserted seed.
 */
export async function mintSeed(input: MintSeedInput): Promise<PlantSeed> {
  const row = buildSeedRecord(input);
  const [inserted] = await db.insert(plantSeeds).values(row).returning();
  return inserted;
}
