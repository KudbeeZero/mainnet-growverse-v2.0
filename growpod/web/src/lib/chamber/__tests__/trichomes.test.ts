import { describe, it, expect } from "vitest";
import {
  maturityMix,
  maturityFor,
  trichHeadColor,
  budSiteDensity,
  shimmer,
  POSITION_DENSITY,
  SHIMMER_MAX_AMP,
  type MaturityMix,
} from "../trichomes";

describe("maturityMix", () => {
  it("always sums to ~1", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const m = maturityMix(p);
      expect(m.clear + m.cloudy + m.amber).toBeCloseTo(1, 6);
    }
  });

  it("starts clear-dominant and ripens toward cloudy/amber", () => {
    const young = maturityMix(0);
    const ripe = maturityMix(1);
    expect(young.clear).toBeGreaterThan(young.cloudy);
    expect(young.amber).toBeLessThan(0.02); // basically no amber early
    expect(ripe.clear).toBeLessThan(young.clear); // clear falls as it ripens
    expect(ripe.amber).toBeGreaterThan(young.amber); // amber climbs late
    expect(ripe.cloudy).toBeGreaterThan(0.2); // cloudy is a real band at ripeness
  });

  it("amber only rises late (quadratic), staying low at mid-flower", () => {
    expect(maturityMix(0.5).amber).toBeLessThan(maturityMix(1).amber * 0.5);
  });

  it("per-strain amber bias raises the amber share", () => {
    expect(maturityMix(1, 1).amber).toBeGreaterThan(maturityMix(1, 0).amber);
  });

  it("clamps out-of-range progress", () => {
    expect(maturityMix(-1).amber).toBeCloseTo(maturityMix(0).amber, 6);
    expect(maturityMix(2).amber).toBeCloseTo(maturityMix(1).amber, 6);
  });
});

describe("maturityFor", () => {
  const mix: MaturityMix = { clear: 0.5, cloudy: 0.35, amber: 0.15 };

  it("buckets a roll against the cumulative mix", () => {
    expect(maturityFor(0.1, mix)).toBe("clear");
    expect(maturityFor(0.49, mix)).toBe("clear");
    expect(maturityFor(0.6, mix)).toBe("cloudy");
    expect(maturityFor(0.84, mix)).toBe("cloudy");
    expect(maturityFor(0.9, mix)).toBe("amber");
    expect(maturityFor(1, mix)).toBe("amber");
  });

  it("is stable for a given roll (no per-frame flicker)", () => {
    expect(maturityFor(0.7, mix)).toBe(maturityFor(0.7, mix));
  });
});

describe("trichHeadColor", () => {
  it("returns an rgba string per maturity", () => {
    expect(trichHeadColor("clear", 0.8)).toMatch(/^rgba\(/);
    expect(trichHeadColor("cloudy", 0.8)).toMatch(/^rgba\(/);
    expect(trichHeadColor("amber", 0.8)).toMatch(/^rgba\(/);
  });

  it("amber is warm (red>blue) and ignores the purple tint", () => {
    const amber = trichHeadColor("amber", 1, 1);
    const [r, , b] = rgbaParts(amber);
    expect(r).toBeGreaterThan(b);
  });

  it("purple phenotype tips clear/cloudy heads toward violet", () => {
    const plain = rgbaParts(trichHeadColor("clear", 1, 0));
    const lav = rgbaParts(trichHeadColor("clear", 1, 1));
    expect(lav[1]).toBeLessThan(plain[1]); // green ↓
    // "violet character" = green sits below the red/blue average
    const violet = (c: number[]) => (c[0] + c[2]) / 2 - c[1];
    expect(violet(lav)).toBeGreaterThan(violet(plain));
  });

  it("carries the alpha through", () => {
    expect(trichHeadColor("cloudy", 0.4)).toContain(",0.4)");
  });
});

describe("budSiteDensity / POSITION_DENSITY", () => {
  it("frost concentrates up top (monotonic in height)", () => {
    expect(budSiteDensity(1)).toBeGreaterThan(budSiteDensity(0.5));
    expect(budSiteDensity(0.5)).toBeGreaterThan(budSiteDensity(0));
  });

  it("stays within the lowerBud..upperCola band", () => {
    expect(budSiteDensity(0)).toBeCloseTo(POSITION_DENSITY.lowerBud, 6);
    expect(budSiteDensity(1)).toBeCloseTo(POSITION_DENSITY.upperCola, 6);
  });

  it("orders the canonical positions cola → fan → stem", () => {
    expect(POSITION_DENSITY.topCola).toBeGreaterThan(POSITION_DENSITY.upperCola);
    expect(POSITION_DENSITY.upperCola).toBeGreaterThan(POSITION_DENSITY.midBud);
    expect(POSITION_DENSITY.midBud).toBeGreaterThan(POSITION_DENSITY.lowerBud);
    expect(POSITION_DENSITY.lowerBud).toBeGreaterThan(POSITION_DENSITY.fanLeaf);
    expect(POSITION_DENSITY.fanLeaf).toBeGreaterThan(POSITION_DENSITY.stem);
    expect(POSITION_DENSITY.stem).toBe(0);
  });
});

describe("shimmer", () => {
  it("stays a small wobble centred on 1.0 (never a strobe)", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t < 20; t += 0.05) {
      const v = shimmer(t, 1.3, 1.0, SHIMMER_MAX_AMP);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(1 - SHIMMER_MAX_AMP - 1e-9);
    expect(max).toBeLessThanOrEqual(1 + SHIMMER_MAX_AMP + 1e-9);
  });

  it("is deterministic and phase-shifted (two phases differ at a given t)", () => {
    expect(shimmer(2, 0.5, 1, 0.1)).toBe(shimmer(2, 0.5, 1, 0.1));
    expect(shimmer(2, 0.5, 1, 0.1)).not.toBe(shimmer(2, 2.5, 1, 0.1));
  });

  it("lower light exposure shrinks the amplitude", () => {
    const full = Math.abs(shimmer(Math.PI / 2, 0, 1, 0.1, 1) - 1);
    const dim = Math.abs(shimmer(Math.PI / 2, 0, 1, 0.1, 0.3) - 1);
    expect(dim).toBeLessThan(full);
  });
});

/** Parse "rgba(r,g,b,a)" → [r,g,b,a]. */
function rgbaParts(s: string): number[] {
  const m = s.match(/rgba?\(([^)]+)\)/);
  return (m ? m[1].split(",") : []).map((x) => Number(x.trim()));
}
