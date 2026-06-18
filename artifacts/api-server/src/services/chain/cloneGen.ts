// ============================================================================
// FRONTIER — Clone Room :: Clone trait derivation (Manual Section 2.2)
// ----------------------------------------------------------------------------
// A clone is cut from a growing plant. Its genetics are NOT hash-derived like a
// Gen 0 seed — they are derived from the PARENT plant's traits with a small
// random deviation, so a clone is "almost but not quite" its parent:
//
//   - Each numeric trait deviates ±5% from the parent (clamped to its range).
//   - strainFamily is inherited unchanged.
//   - mutationFlag inheritance: 3% normally; 15% if the parent had it active.
//
// Pure module — no DB, no network, no chain. The RNG is injectable so the
// derivation is fully reproducible in tests.
// ============================================================================

import type { SeedTraits } from "@workspace/db";

/** ±5% deviation band per the manual. */
export const CLONE_DEVIATION = 0.05;

/** Inherited-mutation odds (Manual Section 2.2). */
export const MUTATION_BASE_CHANCE = 0.03;
export const MUTATION_INHERIT_CHANCE = 0.15;

/** Clamp `v` into [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Apply a ±`CLONE_DEVIATION` deviation to `value` using one draw from `rng`
 * (a value in [0, 1)), then clamp to [lo, hi].
 */
function deviate(
  value: number,
  rng: () => number,
  lo: number,
  hi: number,
): number {
  const factor = 1 + (rng() * 2 - 1) * CLONE_DEVIATION;
  return clamp(value * factor, lo, hi);
}

/**
 * Derive a clone's genetics from its parent's traits (Manual Section 2.2).
 *
 * Numeric fields are deviated ±5% and clamped to the trait-map ranges
 * (Section 3.2). strainFamily is inherited as-is. mutationFlag is rolled with
 * the inheritance odds. `parentSeedId` is left null and is set by the caller to
 * the parent seed's id (mirroring buildSeedRecord), since this pure function
 * does not know the parent's seed id.
 *
 * @param parent The parent plant's SeedTraits.
 * @param rng    Deterministic RNG yielding floats in [0, 1).
 */
export function deriveCloneTraits(
  parent: SeedTraits,
  rng: () => number,
): SeedTraits {
  const mutationChance = parent.mutationFlag
    ? MUTATION_INHERIT_CHANCE
    : MUTATION_BASE_CHANCE;

  return {
    strainFamily: parent.strainFamily, // inherited unchanged
    growthRate: deviate(parent.growthRate, rng, 0.4, 1.8),
    internodeSpacing: deviate(parent.internodeSpacing, rng, 0.2, 1.0),
    leafDensity: deviate(parent.leafDensity, rng, 0.2, 1.0),
    resinProfile: deviate(parent.resinProfile, rng, 0.0, 1.0),
    colorShift: deviate(parent.colorShift, rng, 0.0, 360.0),
    mutationFlag: rng() < mutationChance,
    parentSeedId: null, // set by the caller to the parent seed id
  };
}
