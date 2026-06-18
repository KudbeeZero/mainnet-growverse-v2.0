import { describe, it, expect } from "vitest";
import {
  mulberry32,
  seedForPlant,
  morphologyFor,
  patternForRatio,
  climateModel,
  devParams,
  effectiveDev,
  previewDev,
  nominalGrowDay,
  cycleDays,
  daysToHarvest,
  ageDays,
} from "../morphology";

describe("mulberry32 / seedForPlant", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("derives a stable, id-specific seed", () => {
    expect(seedForPlant("plant-abc")).toBe(seedForPlant("plant-abc"));
    expect(seedForPlant("plant-abc")).not.toBe(seedForPlant("plant-xyz"));
  });
});

describe("morphologyFor", () => {
  it("maps ratio 0 to the sativa archetype", () => {
    const m = morphologyFor(0);
    expect(m.hue).toBeCloseTo(95);
    expect(m.leafW).toBeCloseTo(0.62);
    expect(m.pattern).toBe("spiral");
  });

  it("maps ratio 1 to the indica archetype", () => {
    const m = morphologyFor(1);
    expect(m.hue).toBeCloseTo(122);
    expect(m.leafW).toBeCloseTo(1.3);
    expect(m.pattern).toBe("nodal");
  });

  it("interpolates the midpoint and rounds counts", () => {
    const m = morphologyFor(0.5);
    expect(m.hue).toBeCloseTo((95 + 122) / 2);
    expect(m.pattern).toBe("hybrid");
    expect(Number.isInteger(m.bracts)).toBe(true);
    expect(Number.isInteger(m.leafletMax)).toBe(true);
  });

  it("clamps out-of-range ratios", () => {
    expect(morphologyFor(-1).hue).toBeCloseTo(95);
    expect(morphologyFor(2).hue).toBeCloseTo(122);
  });

  it("chooses pattern by threshold", () => {
    expect(patternForRatio(0.2)).toBe("spiral");
    expect(patternForRatio(0.5)).toBe("hybrid");
    expect(patternForRatio(0.8)).toBe("nodal");
  });
});

describe("climateModel", () => {
  it("reports near-zero stress in the optimal window", () => {
    const c = climateModel({ fan: 45, temp: 24, hum: 52, co2: 1200 });
    expect(c.stress).toBeLessThan(5);
    expect(c.tooMuchFan).toBe(false);
    expect(c.tooLowFan).toBe(false);
  });

  it("flags windburn and stale air at fan extremes", () => {
    expect(climateModel({ fan: 95, temp: 24, hum: 52, co2: 1200 }).tooMuchFan).toBe(true);
    expect(climateModel({ fan: 5, temp: 24, hum: 52, co2: 1200 }).tooLowFan).toBe(true);
  });

  it("raises stress as temp/humidity leave the band", () => {
    const ok = climateModel({ fan: 45, temp: 24, hum: 52, co2: 1200 }).stress;
    const hot = climateModel({ fan: 45, temp: 38, hum: 52, co2: 1200 }).stress;
    expect(hot).toBeGreaterThan(ok);
  });

  it("gives a co2 boost above ~800ppm", () => {
    expect(climateModel({ fan: 45, temp: 24, hum: 52, co2: 400 }).co2Boost).toBe(0);
    expect(climateModel({ fan: 45, temp: 24, hum: 52, co2: 1500 }).co2Boost).toBeGreaterThan(0);
  });
});

describe("devParams / effectiveDev", () => {
  it("clamps development fractions to 0..1", () => {
    const early = devParams(1);
    const late = devParams(999);
    expect(early.budDev).toBe(0);
    expect(late.budDev).toBe(1);
    expect(late.ripe).toBeLessThanOrEqual(1);
  });

  it("zeroes buds outside flowering/harvest regardless of day", () => {
    expect(effectiveDev("vegetative", 60).budDev).toBe(0);
    expect(effectiveDev("seedling", 999).budDev).toBe(0);
    expect(effectiveDev("flowering", 60).budDev).toBeGreaterThan(0);
    expect(effectiveDev("harvest", 70).budDev).toBeGreaterThan(0);
  });
});

describe("daysToHarvest", () => {
  const fl: [number, number] = [55, 65]; // mid 60

  it("is zero once at harvest", () => {
    expect(daysToHarvest("harvest", fl, 100)).toBe(0);
  });

  it("shrinks as the plant advances through stages", () => {
    const seedling = daysToHarvest("seedling", fl, 100);
    const vegetative = daysToHarvest("vegetative", fl, 100);
    const flowering = daysToHarvest("flowering", fl, 100);
    expect(seedling).toBeGreaterThan(vegetative);
    expect(vegetative).toBeGreaterThan(flowering);
  });

  it("estimates a healthy flowering plant: flowering midpoint + the late_flower finish", () => {
    // 60 (flowering mid) + 14 (the additive late_flower ripening stage) = 74.
    expect(daysToHarvest("flowering", fl, 100)).toBeCloseTo(74, 0);
  });

  it("lengthens the estimate when health is poor", () => {
    expect(daysToHarvest("flowering", fl, 40)).toBeGreaterThan(
      daysToHarvest("flowering", fl, 100),
    );
  });
});

describe("nominalGrowDay", () => {
  it("places pre-flower stages below the flowering threshold (no buds)", () => {
    // VEG_END is 44 nominal days; pre-flower stages must land under it so the
    // live render shows no flowers, whatever the wall-clock pace.
    expect(nominalGrowDay("seed", 0)).toBe(0);
    expect(nominalGrowDay("vegetative", 50)).toBeLessThan(44);
    // 100% through veg lands exactly at the flowering threshold (VEG_END=44);
    // the plant hasn't flipped to flowering yet, so still no buds.
    expect(nominalGrowDay("vegetative", 100)).toBeLessThanOrEqual(44);
    // previewDev (the live dev mapper) yields zero buds for any pre-flower day.
    expect(previewDev(nominalGrowDay("vegetative", 50), 60).budDev).toBe(0);
    expect(previewDev(nominalGrowDay("vegetative", 100), 60).budDev).toBe(0);
  });

  it("maps flowering progress onto rising bud development", () => {
    const early = nominalGrowDay("flowering", 10, 60);
    const late = nominalGrowDay("flowering", 90, 60);
    expect(late).toBeGreaterThan(early);
    // A plant deep in flowering renders meaningfully more bud + frost than one
    // that just flipped — even though both could be only days old in real time.
    const earlyDev = previewDev(early, 60);
    const lateDev = previewDev(late, 60);
    expect(lateDev.budDev).toBeGreaterThan(earlyDev.budDev);
    expect(lateDev.trich).toBeGreaterThan(earlyDev.trich);
  });

  it("treats harvest as fully mature (end of the nominal cycle)", () => {
    expect(nominalGrowDay("harvest", 100, 60)).toBeCloseTo(cycleDays(60), 5);
    expect(previewDev(nominalGrowDay("harvest", 100, 60), 60).budDev).toBe(1);
  });

  it("respects the strain's flowering window length", () => {
    // Same 50% flowering progress sits further along the cycle for a longer
    // flowering strain, but both surface buds (past VEG_END).
    const shortFl = nominalGrowDay("flowering", 50, 45);
    const longFl = nominalGrowDay("flowering", 50, 90);
    expect(longFl).toBeGreaterThan(shortFl);
    expect(previewDev(shortFl, 45).budDev).toBeGreaterThan(0);
    expect(previewDev(longFl, 90).budDev).toBeGreaterThan(0);
  });
});

describe("ageDays", () => {
  it("returns 0 for missing/invalid timestamps", () => {
    expect(ageDays(null)).toBe(0);
    expect(ageDays("not-a-date")).toBe(0);
  });

  it("computes elapsed days from a planted timestamp", () => {
    const planted = "2026-01-01T00:00:00Z";
    const now = Date.parse("2026-01-11T00:00:00Z");
    expect(ageDays(planted, now)).toBeCloseTo(10, 5);
  });
});
