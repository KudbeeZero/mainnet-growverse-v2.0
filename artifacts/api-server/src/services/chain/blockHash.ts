// ============================================================================
// FRONTIER — Clone Room :: Block-hash provider (genetics entropy source)
// ----------------------------------------------------------------------------
// Seed genetics are derived from an Algorand block hash (Section 3.2). The hash
// is used ONLY as entropy to seed deterministic trait derivation — it does not
// drive gameplay truth (growpod/CLAUDE.md: "DB is authoritative; the chain is a
// mirror/settlement layer").
//
// Providers are swappable behind this interface, mirroring the Python chain
// layer's Mock/real split: CI and dev run fully offline against the mock; the
// real algod-backed provider (a thin call into the Python chain service) is
// wired in CLONE-09. CI must never require a live key.
// ============================================================================

import { randomBytes } from "node:crypto";

export interface BlockHashProvider {
  /** Return a recent Algorand block hash to seed genetics derivation. */
  latest(): Promise<string>;
}

/**
 * Offline provider: a fresh random 32-byte hex string per call. No network and
 * no secrets, so unit tests and local dev work without a chain connection. The
 * value is stored on the seed row, so the genetics stay reproducible from it.
 */
export class MockBlockHashProvider implements BlockHashProvider {
  async latest(): Promise<string> {
    return randomBytes(32).toString("hex");
  }
}

let cached: BlockHashProvider | null = null;

/** Process-wide provider. Mock until the real algod-backed one ships (CLONE-09). */
export function getBlockHashProvider(): BlockHashProvider {
  if (cached === null) cached = new MockBlockHashProvider();
  return cached;
}

/** Test seam: override the active provider. */
export function setBlockHashProvider(provider: BlockHashProvider): void {
  cached = provider;
}
