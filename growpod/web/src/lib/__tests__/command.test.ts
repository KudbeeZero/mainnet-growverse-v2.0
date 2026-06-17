import { describe, it, expect } from "vitest";
import { traitRows } from "../traits";
import { morphologyRows } from "../morphologyRows";
import { bandSeverity, bandPct, BANDS } from "../envBands";
import { seedId, shipId, deckNumber, powerUse, rarityStars, strainCode } from "../cosmetics";
import { envStatus, conditionStatus, podStatus, alerts } from "../podStatus";
import type { Strain, PlantState, Pod } from "../types";

function strain(over: Partial<Strain> = {}): Strain {
  return {
    id: "s1",
    name: "Blue Dream",
    slug: "blue-dream",
    lineage_type: "hybrid",
    rarity: "epic",
    indica_ratio: 0.4,
    thc_range: [17, 24],
    cbd_range: [0, 1],
    flowering_days: [56, 63],
    yield_range: [400, 600],
    difficulty: 3,
    terpenes: ["myrcene"],
    stability: 0.8,
    generation: 2,
    parent_a_id: null,
    parent_b_id: null,
    is_base_catalog: true,
    genome: null,
    nft_asset_id: null,
    nft_status: "none",
    ...over,
  };
}

const g = (value: number) => ({ value, dominance: "codominant" });

function plant(over: Partial<PlantState> = {}): PlantState {
  return {
    id: "p1",
    player_id: "pl1",
    pod_id: "pod1",
    strain_id: "s1",
    growth_stage: "vegetative",
    planted_at: null,
    height: 10,
    health: 90,
    water_level: 80,
    nutrient_level: 80,
    pest_level: 0,
    disease_level: 0,
    condition_flags: [],
    is_alive: true,
    harvested: false,
    recent_events: [],
    metrics: { vpd_kpa: 1.0, dli_mol: 30, ppfd: 600, photoperiod_hours: 18 },
    ...over,
  };
}

function pod(over: Partial<Pod> = {}): Pod {
  return {
    id: "pod1",
    player_id: "pl1",
    name: "Pod",
    capacity: 1,
    tier: "standard",
    active: true,
    auto_water: false,
    auto_feed: false,
    temperature: 24,
    humidity: 50,
    co2_level: 900,
    light_intensity: 600,
    ph_level: 6.5,
    ...over,
  };
}

describe("traitRows — per-trait range normalization", () => {
  it("returns nothing for a missing strain", () => {
    expect(traitRows(undefined)).toEqual([]);
  });

  it("maps thc against its 0–35 range (35 -> 100)", () => {
    const rows = traitRows(strain({ genome: { thc: g(35) } }));
    expect(rows.find((r) => r.key === "thc")!.value).toBe(100);
  });

  it("maps yield against its 50–800 range (50 -> 0, 800 -> 100)", () => {
    expect(traitRows(strain({ genome: { yield: g(50) } })).find((r) => r.key === "yield")!.value).toBe(0);
    expect(traitRows(strain({ genome: { yield: g(800) } })).find((r) => r.key === "yield")!.value).toBe(100);
  });

  it("scales vigor 0..1 to 0..100 for Growth Rate", () => {
    expect(traitRows(strain({ genome: { vigor: g(1) } })).find((r) => r.key === "growth")!.value).toBe(100);
  });

  it("falls back to sensible defaults when the genome is absent", () => {
    const rows = traitRows(strain({ genome: null }));
    expect(rows).toHaveLength(6);
    // hidden traits default to 0.5 -> 50
    expect(rows.find((r) => r.key === "growth")!.value).toBe(50);
    expect(rows.find((r) => r.key === "resilience")!.value).toBe(50);
    // every value stays in range and they are not all identical
    expect(rows.every((r) => r.value >= 0 && r.value <= 100)).toBe(true);
    expect(new Set(rows.map((r) => r.value)).size).toBeGreaterThan(1);
  });
});

describe("morphologyRows", () => {
  it("reads broader leaves for indica than sativa", () => {
    const indica = morphologyRows(strain({ indica_ratio: 1 }), "vegetative");
    const sativa = morphologyRows(strain({ indica_ratio: 0 }), "vegetative");
    expect(indica.find((r) => r.label === "Leaf Width")!.value).toBe("Wide");
    expect(sativa.find((r) => r.label === "Leaf Width")!.value).toBe("Narrow");
  });

  it("always returns the six rows with non-empty values", () => {
    const rows = morphologyRows(strain(), "flowering");
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.value.length > 0)).toBe(true);
  });
});

describe("envBands helpers", () => {
  it("flags out-of-band and far-out-of-band severities", () => {
    expect(bandSeverity(24, BANDS.temperature)).toBe(0);
    expect(bandSeverity(30, BANDS.temperature)).toBe(1); // just over 28
    expect(bandSeverity(38, BANDS.temperature)).toBe(2); // > half a span past
  });

  it("computes the display percentage within the device range", () => {
    expect(bandPct(10, BANDS.temperature)).toBe(0);
    expect(bandPct(40, BANDS.temperature)).toBe(100);
  });
});

describe("cosmetics — deterministic identifiers", () => {
  it("derives a stable, formatted seed id", () => {
    expect(seedId(strain(), "p1")).toBe(seedId(strain(), "p1"));
    expect(seedId(strain(), "p1")).toMatch(/^[A-Z]{2}-\d{4}-[A-Z]{2}$/);
  });

  it("uses strain initials for the seed-id prefix", () => {
    expect(strainCode("Blue Dream")).toBe("BD");
    expect(seedId(strain(), "p1").startsWith("BD-")).toBe(true);
  });

  it("ship id is stable and well-formed", () => {
    expect(shipId("pl1")).toBe(shipId("pl1"));
    expect(shipId("pl1")).toMatch(/^GSM-[1-9]$/);
  });

  it("deck number is the pod's 1-based position", () => {
    const pods = [pod({ id: "a" }), pod({ id: "b" }), pod({ id: "c" })];
    expect(deckNumber(pods[2], pods)).toBe(3);
    expect(deckNumber(undefined, pods)).toBe(1);
  });

  it("power scales up with light intensity", () => {
    expect(powerUse(pod({ light_intensity: 800 }))).toBeGreaterThan(powerUse(pod({ light_intensity: 200 })));
  });

  it("maps rarity to a star tier", () => {
    expect(rarityStars("common")).toBe(1);
    expect(rarityStars("epic")).toBe(4);
    expect(rarityStars("legendary")).toBe(5);
  });
});

describe("podStatus aggregation", () => {
  it("reports OPTIMAL when environment and condition are clean", () => {
    expect(envStatus(pod(), plant())).toBe("OPTIMAL");
    expect(conditionStatus(plant())).toBe("OPTIMAL");
    expect(podStatus(pod(), plant())).toBe("OPTIMAL");
    expect(alerts(pod(), plant())).toEqual(["Environment is optimal."]);
  });

  it("escalates to CRITICAL on a severe condition flag", () => {
    const sick = plant({ condition_flags: [{ condition: "wilting", severity: "severe" }] });
    expect(conditionStatus(sick)).toBe("CRITICAL");
    expect(podStatus(pod(), sick)).toBe("CRITICAL");
    expect(alerts(pod(), sick).some((a) => a.toLowerCase().includes("wilting"))).toBe(true);
  });

  it("flags far-out environment values", () => {
    expect(envStatus(pod({ temperature: 38 }), plant())).toBe("CRITICAL");
    expect(alerts(pod({ temperature: 38 }), plant()).some((a) => a.startsWith("Temperature"))).toBe(true);
  });

  it("treats a dead plant as CRITICAL", () => {
    expect(conditionStatus(plant({ is_alive: false }))).toBe("CRITICAL");
  });
});
