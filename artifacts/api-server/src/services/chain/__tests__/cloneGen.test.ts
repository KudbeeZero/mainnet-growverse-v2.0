import {
  deriveCloneTraits,
  CLONE_DEVIATION,
  MUTATION_BASE_CHANCE,
  MUTATION_INHERIT_CHANCE,
} from "../cloneGen";
import { seededRandom } from "../../plant/storyEngine";
import type { SeedTraits } from "@workspace/db";

const PARENT: SeedTraits = {
  strainFamily: "hybrid",
  growthRate: 1.2,
  internodeSpacing: 0.6,
  leafDensity: 0.7,
  resinProfile: 0.5,
  colorShift: 180,
  mutationFlag: false,
  parentSeedId: null,
};

describe("deriveCloneTraits", () => {
  it("is deterministic for a given seed", () => {
    const a = deriveCloneTraits(PARENT, seededRandom(42));
    const b = deriveCloneTraits(PARENT, seededRandom(42));
    expect(a).toEqual(b);
  });

  it("inherits the parent's strain family unchanged", () => {
    const clone = deriveCloneTraits(PARENT, seededRandom(7));
    expect(clone.strainFamily).toBe(PARENT.strainFamily);
  });

  it("keeps every numeric trait within ±5% of the parent", () => {
    // Sweep many seeds; each numeric trait must stay inside the deviation band.
    for (let s = 0; s < 200; s++) {
      const c = deriveCloneTraits(PARENT, seededRandom(s));
      const within = (val: number, base: number) =>
        val >= base * (1 - CLONE_DEVIATION) - 1e-9 &&
        val <= base * (1 + CLONE_DEVIATION) + 1e-9;
      expect(within(c.growthRate, PARENT.growthRate)).toBe(true);
      expect(within(c.internodeSpacing, PARENT.internodeSpacing)).toBe(true);
      expect(within(c.leafDensity, PARENT.leafDensity)).toBe(true);
      expect(within(c.resinProfile, PARENT.resinProfile)).toBe(true);
      expect(within(c.colorShift, PARENT.colorShift)).toBe(true);
    }
  });

  it("clamps traits to their valid ranges at the extremes", () => {
    const maxed: SeedTraits = {
      ...PARENT,
      growthRate: 1.8,
      internodeSpacing: 1.0,
      leafDensity: 1.0,
      resinProfile: 1.0,
      colorShift: 360,
    };
    for (let s = 0; s < 100; s++) {
      const c = deriveCloneTraits(maxed, seededRandom(s));
      expect(c.growthRate).toBeLessThanOrEqual(1.8);
      expect(c.internodeSpacing).toBeLessThanOrEqual(1.0);
      expect(c.leafDensity).toBeLessThanOrEqual(1.0);
      expect(c.resinProfile).toBeLessThanOrEqual(1.0);
      expect(c.colorShift).toBeLessThanOrEqual(360);
    }
  });

  it("returns a null parentSeedId (the caller wires lineage)", () => {
    const c = deriveCloneTraits(PARENT, seededRandom(1));
    expect(c.parentSeedId).toBeNull();
  });

  it("inherits mutation rarely from a non-mutant parent (~3%)", () => {
    let hits = 0;
    const N = 4000;
    for (let s = 0; s < N; s++) {
      if (deriveCloneTraits(PARENT, seededRandom(s)).mutationFlag) hits++;
    }
    // Loose statistical bound around MUTATION_BASE_CHANCE.
    expect(hits / N).toBeLessThan(MUTATION_BASE_CHANCE * 2.5);
  });

  it("inherits mutation more often from a mutant parent (~15%)", () => {
    const mutant: SeedTraits = { ...PARENT, mutationFlag: true };
    let hits = 0;
    const N = 4000;
    for (let s = 0; s < N; s++) {
      if (deriveCloneTraits(mutant, seededRandom(s)).mutationFlag) hits++;
    }
    const rate = hits / N;
    // Materially higher than the base chance, in the neighbourhood of 15%.
    expect(rate).toBeGreaterThan(MUTATION_BASE_CHANCE * 2);
    expect(rate).toBeLessThan(MUTATION_INHERIT_CHANCE * 2);
  });
});
