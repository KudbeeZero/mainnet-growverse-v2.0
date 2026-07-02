// Care-button availability — resolves whether prune/train/boost are usable
// RIGHT NOW, and a human reason when they're not, so the UI can show a real
// disabled state instead of letting the player tap and get a toast error.
//
// Pure + side-effect free (mirrors plantAction.ts). Reads `recent_events`
// (the last 20 events returned by GET .../state) the same way the backend's
// own gates do: prune/train are once-per-growth-stage; boost is honest about
// its last-used time but does NOT assert availability from it, since the
// exact cooldown length lives in balance.yaml and isn't exposed to the
// client — asserting a specific "ready in Xh" the frontend can't verify would
// be a fabricated number. (Only the last 20 events are visible to the client,
// so on a very event-heavy stage this can be a stale positive; the existing
// toast-on-error path is the guaranteed-correct fallback either way.)

import type { Plant, PlantEvent } from "@/lib/types";

export interface CareAvailability {
  available: boolean;
  /** Human reason shown when unavailable (or context when available-but-noteworthy). */
  reason: string | null;
  /** Hours since this action was last used, or null if never / unknown. */
  hoursSinceUsed: number | null;
}

function lastEvent(events: PlantEvent[], type: string): PlantEvent | null {
  // recent_events is already newest-first from the server; guard order defensively.
  const matches = events.filter((e) => e.event_type === type && e.timestamp);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (new Date(a.timestamp!) > new Date(b.timestamp!) ? a : b));
}

function hoursSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 3_600_000;
}

/** Once-per-growth-stage gate (prune, train): unavailable if the last event of
 * this type was logged during the plant's CURRENT stage. */
function onceThisStage(plant: Plant, events: PlantEvent[], eventType: string, verb: string, now: number): CareAvailability {
  const ev = lastEvent(events, eventType);
  if (!ev) return { available: true, reason: null, hoursSinceUsed: null };
  const stage = (ev.payload as { stage?: string } | null)?.stage;
  const hrs = ev.timestamp ? hoursSince(ev.timestamp, now) : null;
  if (stage === plant.growth_stage) {
    return { available: false, reason: `Already ${verb} this stage — let it recover first.`, hoursSinceUsed: hrs };
  }
  return { available: true, reason: null, hoursSinceUsed: hrs };
}

/** Resolve availability for every care action, given the plant and its recent
 * event history. `now` is injectable for tests (defaults to Date.now()). */
export function careAvailability(
  plant: Plant,
  events: PlantEvent[],
  now: number = Date.now(),
): Record<"water" | "feed" | "treatPests" | "treatDisease" | "prune" | "train" | "boost", CareAvailability> {
  const alive = plant.is_alive && !plant.harvested;
  const base: CareAvailability = alive
    ? { available: true, reason: null, hoursSinceUsed: null }
    : { available: false, reason: plant.harvested ? "Already harvested." : "Plant is no longer alive.", hoursSinceUsed: null };

  const withLastUsed = (eventType: string): CareAvailability => {
    const ev = lastEvent(events, eventType);
    const hrs = ev?.timestamp ? hoursSince(ev.timestamp, now) : null;
    return { ...base, hoursSinceUsed: hrs };
  };

  return {
    water: withLastUsed("watered"),
    feed: withLastUsed("fed"),
    treatPests: alive
      ? plant.pest_level > 0
        ? withLastUsed("pest_treated")
        : { available: false, reason: "No pests to treat right now.", hoursSinceUsed: lastEvent(events, "pest_treated")?.timestamp ? hoursSince(lastEvent(events, "pest_treated")!.timestamp!, now) : null }
      : base,
    treatDisease: alive
      ? plant.disease_level > 0
        ? withLastUsed("disease_treated")
        : { available: false, reason: "No disease to treat right now.", hoursSinceUsed: lastEvent(events, "disease_treated")?.timestamp ? hoursSince(lastEvent(events, "disease_treated")!.timestamp!, now) : null }
      : base,
    prune: alive ? onceThisStage(plant, events, "pruned", "pruned", now) : base,
    train: alive ? onceThisStage(plant, events, "trained", "trained", now) : base,
    boost: withLastUsed("boosted"),
  };
}

/** Compact "Xh ago" / "Xd ago" label for a last-used hint. */
export function formatSinceUsed(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
