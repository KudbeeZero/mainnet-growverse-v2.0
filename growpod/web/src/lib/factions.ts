import type { WaitlistStandings } from "@/lib/types";

/** Per-faction share of total signups as a 0..100 integer — drives the live
 * standings meter. Pure + deterministic; zero-fills every requested id and
 * returns 0s when there are no signups yet. */
export function factionShares(
  standings: WaitlistStandings | undefined,
  ids: string[],
): Record<string, number> {
  const total = standings?.total ?? 0;
  const counts = standings?.factions ?? {};
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = total > 0 ? Math.round(((counts[id] ?? 0) / total) * 100) : 0;
  }
  return out;
}
