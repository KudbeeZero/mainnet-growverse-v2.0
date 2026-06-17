import { describe, it, expect } from "vitest";
import {
  MAX_BRANCH_DROOP,
  MAX_COLA_LEAN,
  flowerStageMultiplier,
  branchFlex,
  branchDroop,
  colaLean,
  airflowWeighting,
} from "../budPhysics";
import { silhouetteFor } from "../strainVisuals";

describe("flowerStageMultiplier", () => {
  it("follows the brief's stage ladder (seed/veg 0 → harvest 1)", () => {
    expect(flowerStageMultiplier("seedling", 0.5)).toBe(0);
    expect(flowerStageMultiplier("vegetative", 1)).toBe(0);
    // Early flower (budDev ~0) ≈ 0.25, late flower (budDev ~1) ≈ 0.70.
    expect(flowerStageMultiplier("flowering", 0)).toBeCloseTo(0.25, 5);
    expect(flowerStageMultiplier("flowering", 1)).toBeCloseTo(0.7, 5);
    expect(flowerStageMultiplier("flowering", 0.5)).toBeCloseTo(0.475, 5);
    expect(flowerStageMultiplier("harvest", 0)).toBe(1);
  });

  it("ramps gradually and monotonically through flowering", () => {
    const a = flowerStageMultiplier("flowering", 0.2);
    const b = flowerStageMultiplier("flowering", 0.6);
    expect(b).toBeGreaterThan(a);
  });
});

describe("branchFlex", () => {
  it("stiffer (higher branchMul) strains flex less, clamped to a sane band", () => {
    expect(branchFlex(1.26)).toBeLessThan(branchFlex(0.8)); // indica stiffer than sativa
    expect(branchFlex(99)).toBeGreaterThanOrEqual(0.45);
    expect(branchFlex(-99)).toBeLessThanOrEqual(1.05);
  });
});

describe("branchDroop", () => {
  const flex = branchFlex(1.0);

  it("never exceeds the 12° ceiling, even with absurd inputs", () => {
    expect(branchDroop(99, 99, 1, 99, 0.1)).toBeLessThanOrEqual(MAX_BRANCH_DROOP + 1e-9);
    expect(MAX_BRANCH_DROOP).toBeCloseTo((12 * Math.PI) / 180, 9);
  });

  it("is zero outside flowering (stageMul = 0)", () => {
    expect(branchDroop(1.2, flex, 0, 1, 1)).toBe(0);
  });

  it("increases with bud mass and decreases with branch strength", () => {
    const light = branchDroop(0.5, flex, 0.7, 1, 1);
    const heavy = branchDroop(1.4, flex, 0.7, 1, 1);
    expect(heavy).toBeGreaterThan(light);

    const weak = branchDroop(1.2, flex, 0.7, 1, 0.82);
    const strong = branchDroop(1.2, flex, 0.7, 1, 1.2);
    expect(weak).toBeGreaterThan(strong);
  });

  it("small early-flower buds barely sag (~1°), heavy late buds approach the ceiling", () => {
    const early = branchDroop(0.5, flex, 0.25, 1, 1);
    expect(early).toBeLessThan((3 * Math.PI) / 180); // < 3°
    const late = branchDroop(1.5, flex, 1, 1.28, 0.82);
    expect(late).toBeGreaterThan((8 * Math.PI) / 180); // noticeably heavy
  });

  it("orders the curated strains PDP > Animal Mints > G13 for equal mass/stage", () => {
    const g13 = silhouetteFor("g13", 0.5);
    const am = silhouetteFor("animal-mints", 0.5);
    const pdp = silhouetteFor("purple-diddy-punch", 0.5);
    // Moderate load (below the 12° ceiling, where the heaviest strains saturate)
    // so the per-strain ordering is visible rather than all pinned at the clamp.
    const mass = 0.8, stageMul = 0.6;
    const dG13 = branchDroop(mass, flex, stageMul, g13.budWeightMul, g13.branchStrength);
    const dAM = branchDroop(mass, flex, stageMul, am.budWeightMul, am.branchStrength);
    const dPDP = branchDroop(mass, flex, stageMul, pdp.budWeightMul, pdp.branchStrength);
    expect(dPDP).toBeLessThan(MAX_BRANCH_DROOP); // not saturated — ordering is real
    expect(dPDP).toBeGreaterThan(dAM);
    expect(dAM).toBeGreaterThan(dG13);
  });
});

describe("colaLean", () => {
  it("stays within the 1–5° band and grows with bud weight", () => {
    expect(MAX_COLA_LEAN).toBeCloseTo((5 * Math.PI) / 180, 9);
    expect(colaLean(1, 2)).toBeLessThanOrEqual(MAX_COLA_LEAN + 1e-9);
    const g13 = silhouetteFor("g13", 0.5);
    const pdp = silhouetteFor("purple-diddy-punch", 0.5);
    expect(colaLean(1, pdp.budWeightMul)).toBeGreaterThan(colaLean(1, g13.budWeightMul));
    expect(colaLean(0, 1)).toBe(0); // no lean before flowering
  });
});

describe("airflowWeighting", () => {
  it("heavier loads move with smaller amplitude, more lag, slower frequency", () => {
    const lightish = airflowWeighting(0.4, 1);
    const heavy = airflowWeighting(1.5, 1);
    expect(heavy.ampMul).toBeLessThan(lightish.ampMul);
    expect(heavy.lagMul).toBeGreaterThan(lightish.lagMul);
    expect(heavy.freqMul).toBeLessThan(lightish.freqMul);
  });

  it("clamps to safe bands and is the identity when there is no load", () => {
    const none = airflowWeighting(1.2, 0); // stageMul 0 → no load
    expect(none.ampMul).toBe(1);
    expect(none.lagMul).toBe(1);
    expect(none.freqMul).toBe(1);
    const extreme = airflowWeighting(99, 1);
    expect(extreme.ampMul).toBeGreaterThanOrEqual(0.5);
    expect(extreme.freqMul).toBeGreaterThanOrEqual(0.7);
  });

  it("is deterministic", () => {
    expect(airflowWeighting(0.9, 0.7)).toEqual(airflowWeighting(0.9, 0.7));
  });
});
