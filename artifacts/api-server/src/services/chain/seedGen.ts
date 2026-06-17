// ============================================================================
// FRONTIER — Clone Room :: Seed trait generation (Manual Section 3)
// ----------------------------------------------------------------------------
// Pure, deterministic trait derivation. Traits are produced by hashing
// blockHash + playerAddress + nonce with SHA-256 and slicing the hex digest
// into byte ranges (Section 3.2 — Trait Map). The same three inputs always
// produce the same plant.
//
// This file performs NO network calls and NO database access — it is a pure
// function suitable for unit testing.
// ============================================================================

import { createHash } from "node:crypto";
import type { SeedTraits } from "@workspace/db";

/**
 * Derive deterministic plant genetics from on-chain entropy.
 *
 * @param blockHash     Algorand block hash at the seed mint transaction.
 * @param playerAddress Buyer's Algorand wallet address.
 * @param nonce         Server-side UUID generated at purchase time.
 * @returns A fully populated {@link SeedTraits} object (parentSeedId = null).
 */
export function deriveSeedTraits(
  blockHash: string,
  playerAddress: string,
  nonce: string,
): SeedTraits {
  const raw = createHash("sha256")
    .update(`${blockHash}:${playerAddress}:${nonce}`)
    .digest("hex");

  // Read a `len`-nibble window starting at hex offset `start` as an integer.
  // With len = 2 this reads a single byte (0–255), matching the manual's
  // byte-range trait map.
  const n = (start: number, len = 2): number =>
    parseInt(raw.slice(start, start + len), 16);

  return {
    strainFamily: n(0) < 85 ? "indica" : n(0) < 170 ? "sativa" : "hybrid",
    growthRate: 0.4 + (n(2) / 255) * 1.4,
    internodeSpacing: 0.2 + (n(4) / 255) * 0.8,
    leafDensity: 0.2 + (n(6) / 255) * 0.8,
    resinProfile: n(8) / 255,
    colorShift: (n(10) / 255) * 360,
    mutationFlag: n(12) < 8,
    parentSeedId: null,
  };
}
