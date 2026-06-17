// ============================================================================
// FRONTIER — Clone Room :: Seed record assembly (Manual Section 3 + 6.1)
// ----------------------------------------------------------------------------
// Pure assembly of a `plant_seeds` row from genetics entropy. Performs NO
// network calls and NO database access — it only derives traits (seedGen.ts)
// and shapes the row, so it is fully unit-testable.
//
// Genetics are baked in at mint time and are deterministic: the same
// blockHash + ownerAddress + nonce always produce the same plant. The on-chain
// ASA is intentionally NOT created here — minting the NFT is deferred until the
// seed is planted (CLONE-10). Until then asaId / mintTxId / mintedAt stay null
// and the DB row is the authoritative record (see growpod/CLAUDE.md:
// "DB is authoritative; the chain is a mirror/settlement layer").
// ============================================================================

import { randomUUID } from "node:crypto";
import type { InsertPlantSeed, SeedTraits } from "@workspace/db";
import { deriveSeedTraits } from "./seedGen";

export interface MintSeedInput {
  /** Buyer's Algorand wallet address — folded into the genetics hash. */
  ownerAddress: string;
  /** Optional player UUID linking the seed to an in-game account. */
  ownerPlayerId?: string | null;
  /** Algorand block hash used purely as genetics entropy (Section 3.2). */
  blockHash: string;
  /** Server-side entropy. Generated when omitted so each mint is unique. */
  nonce?: string;
  /** Parent seed for bred seeds; null for a Gen 0 original. */
  parentSeedId?: string | null;
  /** Breeding generation counter; 0 for Gen 0 originals. */
  generationNum?: number;
}

/**
 * Assemble (but do not persist) a `plant_seeds` row for a freshly minted seed.
 *
 * Pure: no DB, no chain. The genetics are derived off-chain from the supplied
 * entropy; the returned row carries null chain fields (asaId / mintTxId /
 * mintedAt) because the ASA is minted later, at plant time.
 */
export function buildSeedRecord(input: MintSeedInput): InsertPlantSeed {
  const nonce = input.nonce ?? randomUUID();
  const parentSeedId = input.parentSeedId ?? null;

  // deriveSeedTraits always returns parentSeedId: null (Gen 0). Override it so
  // bred seeds carry their lineage in the traits blob as well as the column.
  const traits: SeedTraits = {
    ...deriveSeedTraits(input.blockHash, input.ownerAddress, nonce),
    parentSeedId,
  };

  return {
    seedId: randomUUID(),
    asaId: null, // ASA minted at plant time (CLONE-10) — DB is truth until then
    ownerAddress: input.ownerAddress,
    ownerPlayerId: input.ownerPlayerId ?? null,
    traits,
    mintTxId: null,
    mintedAt: null,
    parentSeedId,
    generationNum: input.generationNum ?? 0,
    nonce,
    blockHash: input.blockHash,
  };
}
