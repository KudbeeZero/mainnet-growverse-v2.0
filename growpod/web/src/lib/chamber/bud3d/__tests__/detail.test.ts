import { describe, it, expect } from "vitest";
import { buildFrost, buildPistils, buildSugarLeaves, pistilColor } from "@/lib/chamber/bud3d/detail";
import { buildCola } from "@/lib/chamber/bud3d/cola";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorForStrain } from "@/lib/chamber/strainVisuals";

const DNA = budDnaFor("white-fire-og", budColorForStrain("white-fire-og", 100, 999));
const COLA = buildCola(DNA, 99, { budDev: 1 });

describe("buildFrost", () => {
  it("is deterministic for a seed", () => {
    const a = buildFrost(COLA, { seed: 1, density: 0.9, ripe: 0.5 });
    const b = buildFrost(COLA, { seed: 1, density: 0.9, ripe: 0.5 });
    expect(a).toEqual(b);
  });
  it("more density → more glands (below the budget cap)", () => {
    // Small cola so neither density saturates the 250-gland desktop budget.
    const small = buildCola(DNA, 99, { budDev: 0.2, maxInstances: 18 });
    const lo = buildFrost(small, { seed: 1, density: 0.2, ripe: 0.5 }).length;
    const hi = buildFrost(small, { seed: 1, density: 1.0, ripe: 0.5 }).length;
    expect(hi).toBeGreaterThan(lo);
  });
  it("no frost at zero density", () => {
    expect(buildFrost(COLA, { seed: 1, density: 0, ripe: 0.5 })).toHaveLength(0);
  });
  it("respects the device budget (mobile < desktop ceiling)", () => {
    const m = buildFrost(COLA, { seed: 1, density: 1, ripe: 1, isMobile: true });
    expect(m.length).toBeLessThanOrEqual(100);
  });
  it("early ripeness skews clear, late skews amber", () => {
    const early = buildFrost(COLA, { seed: 3, density: 1, ripe: 0.05 });
    const late = buildFrost(COLA, { seed: 3, density: 1, ripe: 1, amberBias: 1 });
    const amber = (xs: { mat: number }[]) => xs.filter((x) => x.mat === 2).length / xs.length;
    expect(amber(late)).toBeGreaterThan(amber(early));
  });
});

describe("pistilColor", () => {
  it("fresh is near-white, ripe ambers, brown darkens", () => {
    expect(pistilColor(0, 0)[0]).toBeGreaterThan(0.95);
    const amber = pistilColor(1, 0);
    expect(amber[0]).toBeGreaterThan(amber[2]); // warmer (r > b)
    const brown = pistilColor(1, 1);
    expect(brown[0]).toBeLessThan(0.6);
  });
});

describe("buildPistils", () => {
  it("is deterministic for a seed", () => {
    const a = buildPistils(COLA, { seed: 2, chance: 0.5, ripe: 0.3, brown: 0 });
    const b = buildPistils(COLA, { seed: 2, chance: 0.5, ripe: 0.3, brown: 0 });
    expect(a).toEqual(b);
  });
  it("higher chance → more pistils", () => {
    const lo = buildPistils(COLA, { seed: 2, chance: 0.1, ripe: 0.3, brown: 0 }).length;
    const hi = buildPistils(COLA, { seed: 2, chance: 0.9, ripe: 0.3, brown: 0 }).length;
    expect(hi).toBeGreaterThanOrEqual(lo);
  });
  it("directions are unit vectors", () => {
    const ps = buildPistils(COLA, { seed: 2, chance: 1, ripe: 0.3, brown: 0 });
    for (const p of ps.slice(0, 20)) {
      const m = Math.hypot(p.dir[0], p.dir[1], p.dir[2]);
      expect(m).toBeCloseTo(1, 5);
    }
  });
  it("each hair carries a roll in [0, 2π) so a bundle fans every way", () => {
    const ps = buildPistils(COLA, { seed: 2, chance: 1, ripe: 0.3, brown: 0 });
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps.slice(0, 20)) {
      expect(p.roll).toBeGreaterThanOrEqual(0);
      expect(p.roll).toBeLessThan(Math.PI * 2);
    }
    // not all identical (the rolls actually vary)
    const rolls = new Set(ps.map((p) => p.roll.toFixed(4)));
    expect(rolls.size).toBeGreaterThan(1);
  });
});

describe("buildSugarLeaves", () => {
  it("is deterministic for a seed", () => {
    const a = buildSugarLeaves(COLA, { seed: 5, amount: 0.7, frost: 0.5 });
    const b = buildSugarLeaves(COLA, { seed: 5, amount: 0.7, frost: 0.5 });
    expect(a).toEqual(b);
  });
  it("more amount → more leaves; zero amount → none", () => {
    const lo = buildSugarLeaves(COLA, { seed: 5, amount: 0.15, frost: 0.5 }).length;
    const hi = buildSugarLeaves(COLA, { seed: 5, amount: 0.95, frost: 0.5 }).length;
    expect(hi).toBeGreaterThanOrEqual(lo);
    expect(buildSugarLeaves(COLA, { seed: 5, amount: 0, frost: 0.5 })).toHaveLength(0);
  });
  it("directions are unit vectors and scales are positive", () => {
    const ls = buildSugarLeaves(COLA, { seed: 5, amount: 1, frost: 0.8 });
    for (const l of ls.slice(0, 20)) {
      expect(Math.hypot(l.dir[0], l.dir[1], l.dir[2])).toBeCloseTo(1, 5);
      expect(l.scale).toBeGreaterThan(0);
    }
  });
  it("more frost → lighter (whiter-green) leaves", () => {
    const avgR = (xs: { color: [number, number, number] }[]) =>
      xs.reduce((s, x) => s + x.color[0], 0) / (xs.length || 1);
    const dry = buildSugarLeaves(COLA, { seed: 7, amount: 1, frost: 0 });
    const frosty = buildSugarLeaves(COLA, { seed: 7, amount: 1, frost: 1 });
    expect(avgR(frosty)).toBeGreaterThan(avgR(dry));
  });
  it("respects the device budget (mobile ≤ desktop ceiling)", () => {
    const m = buildSugarLeaves(COLA, { seed: 5, amount: 1, frost: 1, isMobile: true });
    expect(m.length).toBeLessThanOrEqual(45);
  });
});
