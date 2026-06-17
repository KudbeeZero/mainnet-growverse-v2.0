import type { PlantGrow, SeedTraits } from "@workspace/db";
import {
  EVENT_REGISTRY,
  applyOutcome,
  seededRandom,
  selectEvent,
} from "../storyEngine";

// --- Test fixtures ----------------------------------------------------------

const baseTraits: SeedTraits = {
  strainFamily: "hybrid",
  growthRate: 1.0,
  internodeSpacing: 0.5,
  leafDensity: 0.6,
  resinProfile: 0.5,
  colorShift: 120,
  mutationFlag: false,
  parentSeedId: null,
};

function makeGrow(overrides: Partial<PlantGrow> = {}): PlantGrow {
  return {
    growId: "grow-1",
    seedId: "seed-1",
    ownerPlayerId: "player-1",
    stage: "veg",
    startedAt: 0,
    stageAt: 0,
    stageEvents: [],
    tendActions: 0,
    cloneCut: false,
    harvestNftId: null,
    rarityTier: null,
    parentPlotId: null,
    ...overrides,
  };
}

const FIXED_NOW = 1_700_000_500; // now % 1000 === 500

// --- seededRandom -----------------------------------------------------------

describe("seededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = seededRandom(12345);
    const b = seededRandom(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("yields floats in the [0, 1) range", () => {
    const r = seededRandom(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// --- selectEvent ------------------------------------------------------------

describe("selectEvent", () => {
  it("is deterministic for identical inputs", () => {
    const grow = makeGrow({ tendActions: 1 });
    const a = selectEvent(grow, baseTraits, {}, FIXED_NOW);
    const b = selectEvent(grow, baseTraits, {}, FIXED_NOW);
    expect(a).toBe(b);
  });

  it("returns null when no event is eligible", () => {
    // seedling stage with healthy traits / 3+ tends => nothing triggers.
    const grow = makeGrow({ stage: "seedling", tendActions: 5 });
    const healthy: SeedTraits = { ...baseTraits, leafDensity: 0.9 };
    expect(selectEvent(grow, healthy, {}, FIXED_NOW)).toBeNull();
  });

  it("only ever returns an event whose trigger is currently satisfied", () => {
    const grow = makeGrow({ tendActions: 1 }); // veg, low tend
    const result = selectEvent(grow, baseTraits, { biome: "volcanic" }, FIXED_NOW);
    expect(result).not.toBeNull();
    const def = EVENT_REGISTRY.find((e) => e.type === result);
    expect(def).toBeDefined();
    expect(def!.trigger(grow, baseTraits, { biome: "volcanic" }, FIXED_NOW)).toBe(
      true,
    );
  });

  it("includes the volcanic environmental anomaly only when biome is volcanic", () => {
    // Force the pool to contain only environmental_anomaly by neutralising
    // other veg triggers: high tendActions, healthy leaves, no mutation.
    const grow = makeGrow({ tendActions: 9, stageAt: FIXED_NOW });
    const healthy: SeedTraits = { ...baseTraits, leafDensity: 0.9 };

    const withBiome = selectEvent(
      grow,
      healthy,
      { biome: "volcanic", photoperiodSet: true },
      FIXED_NOW,
    );
    expect(withBiome).toBe("environmental_anomaly");

    const withoutBiome = selectEvent(
      grow,
      healthy,
      { photoperiodSet: true },
      FIXED_NOW,
    );
    expect(withoutBiome).toBeNull();
  });
});

// --- applyOutcome -----------------------------------------------------------

describe("applyOutcome", () => {
  it("returns the outcome for a valid event + choice", () => {
    const outcome = applyOutcome("spider_mite_outbreak", "prune");
    expect(outcome).toEqual({ yieldMod: -0.1, tag: "clone_eligible" });
  });

  it("returns null for an unknown choice", () => {
    expect(applyOutcome("spider_mite_outbreak", "nope")).toBeNull();
  });

  it("returns a copy, not the registry object (no mutation leak)", () => {
    const a = applyOutcome("nutrient_deficiency", "feed_heavy")!;
    a.yieldMod = 999;
    const b = applyOutcome("nutrient_deficiency", "feed_heavy")!;
    expect(b.yieldMod).toBeUndefined();
  });

  it("every registry choice resolves through applyOutcome", () => {
    for (const ev of EVENT_REGISTRY) {
      for (const c of ev.choices) {
        expect(applyOutcome(ev.type, c.id)).toEqual(c.outcome);
      }
    }
  });
});
