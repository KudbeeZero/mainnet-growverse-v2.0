import type { CureStatus, Rarity } from "@/lib/types";

// Ordered low -> high, mirrors `enums.py` RARITY_ORDER.
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/**
 * Mirrors `balance.yaml`'s `nft.mint_min_rarity` (currently "rare"). This is a
 * UI-gating hint only — the server (`minting_service.py`) is the sole source
 * of truth and re-checks the threshold on every mint request.
 */
export const MINT_MIN_RARITY: Rarity = "rare";

export function rarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function meetsMintRarity(rarity: Rarity, minRarity: Rarity = MINT_MIN_RARITY): boolean {
  return rarityIndex(rarity) >= rarityIndex(minRarity);
}

/** Mint is only offered when the harvest isn't mid-cure and clears the rarity floor. */
export function canMint(cureStatus: CureStatus | undefined, rarity: Rarity): boolean {
  return cureStatus !== "curing" && meetsMintRarity(rarity);
}

/** Sell is disabled mid-cure — selling a curing harvest is a guaranteed backend error. */
export function canSell(cureStatus: CureStatus | undefined): boolean {
  return cureStatus !== "curing";
}

/** ISO deadline for "Finish cure" — null when the harvest carries no cure timing data. */
export function cureDeadlineIso(
  startedAt: string | null | undefined,
  targetHours: number | null | undefined,
): string | null {
  if (!startedAt || !targetHours) return null;
  const startedMs = new Date(startedAt).getTime();
  if (Number.isNaN(startedMs)) return null;
  return new Date(startedMs + targetHours * 3_600_000).toISOString();
}

/** "Finish cure" is disabled until the deadline passes; missing timing data never blocks it. */
export function canFinishCure(nowMs: number, deadlineIso: string | null): boolean {
  if (!deadlineIso) return true;
  return nowMs >= new Date(deadlineIso).getTime();
}
