// Engines 1 & 2 — Apical Dominance / Multi-Cola architecture. Pure, deterministic,
// DOM-free (unit-tested under vitest).
//
// Cannabis grows a single dominant leader (apical meristem) that chemically
// suppresses the lateral tops below it — high apical dominance yields one fat top
// cola over progressively smaller side branches (a spear / Christmas-tree, e.g.
// G13). Top the plant, or grow a low-dominance phenotype, and several upper
// branches escape suppression and race the leader to the canopy, each finishing
// its own cola (a bushy, multi-headed bush, e.g. Purple Diddy Punch / White
// Rhino). This module turns the strain's `apicalDominance` (0..1) into HOW MANY
// tops compete and HOW the flower mass is shared between them; the renderer
// (`chamberCore.buildPlant`) consumes it to promote the top side branches into
// upright co-colas and to scale the central cola down accordingly.

import { clamp, lerp, smooth } from "./morphology";

export interface ColaTops {
  /** Total competing tops including the leader (1 = single cola, up to 4). */
  count: number;
  /** Mass share of the central leader cola (≤1; the rest is split between rivals). */
  leaderShare: number;
  /**
   * Mass share per *secondary* (co-dominant) top, leader-first ordering, length
   * `count − 1`. Each ≤ leaderShare. Empty when the plant is single-cola.
   */
  secondaryShares: number[];
  /** 0 (full single-cola suppression) → 1 (rivals fully escape) — uprightness gain. */
  release: number;
}

/**
 * Resolve the cola architecture for a strain's apical dominance.
 *
 * - **High dominance (→1):** `count = 1`, the leader keeps ~all the mass, rivals
 *   stay subordinate side branches (`release → 0`). Reproduces the legacy single
 *   top cola, so spear strains are unchanged.
 * - **Low dominance (→0):** up to 4 co-dominant tops, the leader's share drops
 *   toward an even split, rivals straighten up toward the apex (`release → 1`).
 *
 * The split is weighted so the leader always reads as *the* main cola (it keeps a
 * little more than an even share) — a multi-cola bush, not N identical spikes.
 */
export function colaTops(apicalDominance: number): ColaTops {
  const dom = clamp(apicalDominance, 0, 1);
  const release = smooth(clamp((1 - dom - 0.12) / 0.78, 0, 1));
  // 1 top at high dominance → up to 4 as it releases.
  const count = clamp(Math.round(lerp(1, 4, release)), 1, 4);
  if (count <= 1) {
    return { count: 1, leaderShare: 1, secondaryShares: [], release };
  }
  // Even share would be 1/count; bias the leader above it so it still dominates,
  // and let that bias fade as dominance drops (very low dom → nearly even tops).
  const even = 1 / count;
  const leaderBias = lerp(0.18, 0.5, dom); // how far above even the leader sits
  const leaderShare = clamp(even + (1 - even) * leaderBias, even, 0.85);
  const rest = 1 - leaderShare;
  const secondaryShares = new Array(count - 1).fill(rest / (count - 1));
  return { count, leaderShare, secondaryShares, release };
}
