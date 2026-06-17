// Cosmetic, deterministic identifiers for the Command Center HUD.
//
// The mockup shows a ship/deck breadcrumb, a seed ID (e.g. "BD-0427-AX"), a
// power-draw readout and a rarity star tier. None of these are backend fields, so
// they're derived deterministically from existing ids (reusing the chamber's FNV
// hash + mulberry32 PRNG) — stable per plant/player, no backend change. If real
// telemetry / authored identifiers arrive later, swap these out.

import { mulberry32, seedForPlant } from "@/lib/chamber/morphology";
import type { Pod, Rarity, Strain } from "@/lib/types";

/** Up-to-2-letter code from a strain name ("Blue Dream" -> "BD"). */
export function strainCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || "GP").toUpperCase();
}

// Unambiguous suffix alphabet (no I/O/0/1).
const SUFFIX = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Deterministic seed serial, e.g. "BD-0427-AX". */
export function seedId(strain: Strain | undefined, plantId: string): string {
  const r = mulberry32(seedForPlant(plantId));
  const digits = String(Math.floor(r() * 10000)).padStart(4, "0");
  const a = SUFFIX[Math.floor(r() * SUFFIX.length)];
  const b = SUFFIX[Math.floor(r() * SUFFIX.length)];
  const code = strain ? strainCode(strain.name) : "GP";
  return `${code}-${digits}-${a}${b}`;
}

/** Deterministic ship designation per player, e.g. "GSM-4". */
export function shipId(playerId: string): string {
  const r = mulberry32(seedForPlant(playerId || "guest"));
  return `GSM-${1 + Math.floor(r() * 9)}`;
}

/** 1-based deck number = the pod's position in the player's pod list. */
export function deckNumber(pod: Pod | undefined, pods: Pod[] | undefined): number {
  if (!pod || !pods) return 1;
  const idx = pods.findIndex((p) => p.id === pod.id);
  return idx >= 0 ? idx + 1 : 1;
}

const TIER_BASE: Record<string, number> = { basic: 80, standard: 120, pro: 180 };

/** Estimated pod power draw (W) from light intensity + tier baseline. */
export function powerUse(pod: Pod | undefined): number {
  const light = pod?.light_intensity ?? 600;
  const base = TIER_BASE[pod?.tier ?? "standard"] ?? 120;
  return Math.round(base + light * 0.4);
}

const RARITY_STAR: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

/** Star tier (1..5) for a rarity. */
export function rarityStars(rarity: Rarity): number {
  return RARITY_STAR[rarity] ?? 1;
}
