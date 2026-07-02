import { describe, it, expect } from "vitest";
import { careAvailability, formatSinceUsed } from "@/lib/careAvailability";
import type { Plant, PlantEvent } from "@/lib/types";

function plant(over: Partial<Plant> = {}): Plant {
  return {
    id: "plant-1",
    player_id: "p1",
    pod_id: "pod-1",
    strain_id: "s1",
    growth_stage: "vegetative",
    planted_at: "2026-06-14T00:00:00Z",
    height: 10,
    health: 90,
    water_level: 80,
    nutrient_level: 80,
    pest_level: 0,
    disease_level: 0,
    condition_flags: [],
    is_alive: true,
    harvested: false,
    ...over,
  };
}

function event(over: Partial<PlantEvent> = {}): PlantEvent {
  return {
    id: "ev-1",
    plant_id: "plant-1",
    timestamp: "2026-07-02T00:00:00Z",
    event_type: "watered",
    severity: null,
    payload: null,
    ...over,
  };
}

const NOW = new Date("2026-07-02T06:00:00Z").getTime();

describe("careAvailability", () => {
  it("everything is available on a fresh plant with no event history", () => {
    const a = careAvailability(plant(), [], NOW);
    expect(a.water.available).toBe(true);
    expect(a.prune.available).toBe(true);
    expect(a.train.available).toBe(true);
  });

  it("disables prune once it's been used in the CURRENT stage", () => {
    const p = plant({ growth_stage: "vegetative" });
    const events = [event({ event_type: "pruned", payload: { stage: "vegetative" }, timestamp: "2026-07-02T02:00:00Z" })];
    const a = careAvailability(p, events, NOW);
    expect(a.prune.available).toBe(false);
    expect(a.prune.reason).toMatch(/already/i);
    expect(a.prune.hoursSinceUsed).toBeCloseTo(4, 0);
  });

  it("re-enables prune once the plant has moved to a new stage", () => {
    const p = plant({ growth_stage: "flowering" });
    const events = [event({ event_type: "pruned", payload: { stage: "vegetative" }, timestamp: "2026-07-02T02:00:00Z" })];
    const a = careAvailability(p, events, NOW);
    expect(a.prune.available).toBe(true);
  });

  it("disables train once it's been used in the CURRENT stage", () => {
    const p = plant({ growth_stage: "vegetative" });
    const events = [event({ event_type: "trained", payload: { stage: "vegetative" }, timestamp: "2026-07-02T05:00:00Z" })];
    const a = careAvailability(p, events, NOW);
    expect(a.train.available).toBe(false);
  });

  it("gates treatPests on an active pest level, independent of history", () => {
    expect(careAvailability(plant({ pest_level: 0 }), [], NOW).treatPests.available).toBe(false);
    expect(careAvailability(plant({ pest_level: 12 }), [], NOW).treatPests.available).toBe(true);
  });

  it("gates treatDisease on an active disease level", () => {
    expect(careAvailability(plant({ disease_level: 0 }), [], NOW).treatDisease.available).toBe(false);
    expect(careAvailability(plant({ disease_level: 12 }), [], NOW).treatDisease.available).toBe(true);
  });

  it("boost stays available (cooldown length isn't known client-side) but reports last-used", () => {
    const events = [event({ event_type: "boosted", timestamp: "2026-07-02T04:30:00Z" })];
    const a = careAvailability(plant(), events, NOW);
    expect(a.boost.available).toBe(true);
    expect(a.boost.hoursSinceUsed).toBeCloseTo(1.5, 1);
  });

  it("everything is unavailable with a reason for a dead or harvested plant", () => {
    const dead = careAvailability(plant({ is_alive: false }), [], NOW);
    expect(dead.water.available).toBe(false);
    expect(dead.water.reason).toMatch(/no longer alive/i);

    const harvested = careAvailability(plant({ harvested: true }), [], NOW);
    expect(harvested.prune.available).toBe(false);
    expect(harvested.prune.reason).toMatch(/harvested/i);
  });
});

describe("formatSinceUsed", () => {
  it("formats null as null", () => {
    expect(formatSinceUsed(null)).toBeNull();
  });
  it("formats sub-hour as 'just now'", () => {
    expect(formatSinceUsed(0.3)).toBe("just now");
  });
  it("formats hours", () => {
    expect(formatSinceUsed(5)).toBe("5h ago");
  });
  it("formats days", () => {
    expect(formatSinceUsed(50)).toBe("2d ago");
  });
});
