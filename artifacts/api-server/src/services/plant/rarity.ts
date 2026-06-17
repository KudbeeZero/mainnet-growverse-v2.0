// ============================================================================
// FRONTIER — Clone Room :: Harvest rarity tiers (Manual Section 5)
// ----------------------------------------------------------------------------
// Rarity is decided at harvest time by combining the plant's resinProfile, the
// resolved story events, the tend count, and the biome of the parent land
// parcel. This is a pure, deterministic function of those inputs — the
// headline "drop rates" in the manual are the natural distribution that falls
// out of how often each requirement is met, NOT an independent dice roll.
//
//   Common     standard grow, no story events
//   Uncommon   1+ story event resolved positively
//   Rare       mutation event + 3+ tend actions
//   Legendary  mutation + trichome window (waited) + perfect pH
//   Mythic     all Legendary reqs + volcanic biome parent plot
//
// Pure module — no DB, no network.
// ============================================================================

export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "legendary"
  | "mythic";

export interface RarityInputs {
  /** Count of story events the player resolved with a positive outcome. */
  positiveEvents: number;
  /** An `unexpected_mutation` event was resolved this grow. */
  hasMutationEvent: boolean;
  /** Tend actions registered against the grow. */
  tendActions: number;
  /** The `perfect_trichome_window` event was resolved by waiting 48h. */
  trichomeWaited: boolean;
  /** pH was kept in the perfect band for the grow. */
  perfectPh: boolean;
  /** Biome of the parent FRONTIER plot, e.g. "volcanic". */
  biome?: string | null;
}

/**
 * Compute the harvest rarity tier from resolved-grow inputs (Section 5).
 * Returns the highest tier whose requirements are satisfied.
 */
export function computeRarity(input: RarityInputs): RarityTier {
  const {
    positiveEvents,
    hasMutationEvent,
    tendActions,
    trichomeWaited,
    perfectPh,
    biome,
  } = input;

  const legendaryReqs = hasMutationEvent && trichomeWaited && perfectPh;

  if (legendaryReqs && biome === "volcanic") return "mythic";
  if (legendaryReqs) return "legendary";
  if (hasMutationEvent && tendActions >= 3) return "rare";
  if (positiveEvents >= 1) return "uncommon";
  return "common";
}
