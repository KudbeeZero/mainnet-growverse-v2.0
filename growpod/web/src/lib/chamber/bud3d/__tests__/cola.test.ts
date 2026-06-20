import { describe, it, expect } from "vitest";
import { buildCola, hslToRgb } from "@/lib/chamber/bud3d/cola";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";

const DNA = budDnaFor("g13", budColorForStrain("g13", 110, 12345));

describe("hslToRgb", () => {
  it("maps pure hues into 0..1 channels", () => {
    expect(hslToRgb({ hue: 0, sat: 100, lit: 50 })).toEqual([1, 0, 0]);
    const [r, g, b] = hslToRgb({ hue: 120, sat: 100, lit: 50 });
    expect(g).toBeCloseTo(1);
    expect(r).toBeCloseTo(0);
    expect(b).toBeCloseTo(0);
  });
  it("greys out at zero saturation", () => {
    expect(hslToRgb({ hue: 200, sat: 0, lit: 40 })).toEqual([0.4, 0.4, 0.4]);
  });
});

describe("buildCola", () => {
  it("is deterministic for a given seed", () => {
    const a = buildCola(DNA, 42, { budDev: 1 });
    const b = buildCola(DNA, 42, { budDev: 1 });
    expect(a).toEqual(b);
  });

  it("grows more calyxes as the bud develops (inside-out accretion)", () => {
    const early = buildCola(DNA, 7, { budDev: 0.1 }).length;
    const ripe = buildCola(DNA, 7, { budDev: 1 }).length;
    expect(ripe).toBeGreaterThan(early);
  });

  it("swells calyxes as it develops (same seed, bigger scale)", () => {
    const early = buildCola(DNA, 7, { budDev: 0.1 })[0].scale[1];
    const ripe = buildCola(DNA, 7, { budDev: 1 })[0].scale[1];
    expect(ripe).toBeGreaterThan(early);
  });

  it("respects the instance cap (mobile/perf budget)", () => {
    expect(buildCola(DNA, 7, { budDev: 1, maxInstances: 40 }).length).toBeLessThanOrEqual(40);
  });

  it("clamps bud width to a sane fraction of height (no runaway cola)", () => {
    const fat = { ...DNA, maxBudWidth: 100000 }; // absurd width
    const xs = buildCola(fat, 7, { budDev: 1 }).map((c) => Math.abs(c.pos[0]));
    // aspect is clamped to 0.62 → half-width ≤ ~0.62 in unit space.
    expect(Math.max(...xs)).toBeLessThan(0.75);
  });

  it("keeps the cola within unit height", () => {
    const ys = buildCola(DNA, 7, { budDev: 1 }).map((c) => c.pos[1]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(1.1);
  });
});
