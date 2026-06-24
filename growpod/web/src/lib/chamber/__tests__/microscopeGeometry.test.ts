import { describe, expect, it } from "vitest";
import {
  CALYX_COUNT,
  PISTIL_COUNT,
  TRICHOME_COUNT,
  buildBudGeometry,
  frostAlpha,
  headColor,
} from "@/lib/chamber/microscopeGeometry";

describe("buildBudGeometry", () => {
  it("is deterministic for a given seed", () => {
    expect(buildBudGeometry(42, 3)).toEqual(buildBudGeometry(42, 3));
  });

  it("produces the expected element counts", () => {
    const g = buildBudGeometry(7, 2);
    expect(g.calyxes).toHaveLength(CALYX_COUNT);
    expect(g.trichomes).toHaveLength(TRICHOME_COUNT);
    expect(g.pistils).toHaveLength(PISTIL_COUNT);
  });

  it("gives every trichome the new shape fields in range", () => {
    for (const t of buildBudGeometry(99, 4).trichomes) {
      expect(t.ox).toBeGreaterThanOrEqual(0.78);
      expect(t.ox).toBeLessThanOrEqual(1.22);
      expect(Math.abs(t.tilt)).toBeLessThanOrEqual(0.22);
      expect(t.rot).toBeGreaterThanOrEqual(0);
    }
  });

  it("gives calyxes a teardrop skew and pistils a base width in range", () => {
    const g = buildBudGeometry(123, 3);
    for (const c of g.calyxes) {
      expect(c.skew).toBeGreaterThanOrEqual(0.8);
      expect(c.skew).toBeLessThanOrEqual(1.2);
    }
    for (const p of g.pistils) {
      expect(p.baseW).toBeGreaterThanOrEqual(2.6);
      expect(p.baseW).toBeLessThanOrEqual(4.4);
    }
  });

  it("never assigns a terpene index when the strain has none", () => {
    for (const t of buildBudGeometry(5, 0).trichomes) {
      expect(t.terp).toBe(-1);
    }
  });
});

describe("headColor", () => {
  it("returns a valid rgba string across the maturity range", () => {
    for (const m of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      expect(headColor(m)).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    }
  });
});

describe("frostAlpha", () => {
  it("frosts up as maturity climbs (clamped, monotonic-ish)", () => {
    expect(frostAlpha(0)).toBeLessThan(frostAlpha(0.5));
    expect(frostAlpha(0.5)).toBeLessThan(frostAlpha(1));
    expect(frostAlpha(-5)).toBe(frostAlpha(0));
    expect(frostAlpha(5)).toBe(frostAlpha(1));
  });
});
