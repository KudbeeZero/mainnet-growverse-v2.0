import { describe, expect, it } from "vitest";
import {
  CALYX_COUNT,
  PISTIL_COUNT,
  TRICHOME_COUNT,
  buildBudGeometry,
  calyxTint,
  frostAlpha,
  headColor,
  maturityFromTelemetry,
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

describe("calyxTint", () => {
  it("uses the authored calyx hue/sat when a BudColor is provided", () => {
    // Purple Diddy Punch's authored values (strainVisuals.ts) — must render violet.
    const pdp = { anthocyanin: 0.95, calyxHue: 282, calyxSat: 60 };
    expect(calyxTint(pdp, 0, 0.99)).toEqual({ hue: 282, sat: 60 });
  });

  it("flips an accentFrac share of calyxes to the accent hue", () => {
    const gelato = { anthocyanin: 0.6, calyxHue: 128, calyxSat: 56, accentHue: 292, accentFrac: 0.5 };
    expect(calyxTint(gelato, 0, 0.2).hue).toBe(292); // roll below accentFrac → accent
    expect(calyxTint(gelato, 0, 0.8).hue).toBe(128); // roll above → base green
  });

  it("legacy scalar fallback actually reaches violet (the old 96-p*50 bug)", () => {
    expect(calyxTint(undefined, 0, 0).hue).toBe(96); // no purple → green
    expect(calyxTint(undefined, 1, 0).hue).toBeGreaterThanOrEqual(260); // full purple → violet
    expect(calyxTint(undefined, 2, 0).hue).toBe(calyxTint(undefined, 1, 0).hue); // clamped
  });
});

describe("maturityFromTelemetry", () => {
  it("maps the sim's clear/cloudy/amber split onto the 0..1 maturity ramp", () => {
    // The care-loop fixture's peak-window telemetry: cloudy-dominant, little amber.
    const m = maturityFromTelemetry({ clear_pct: 30, cloudy_pct: 62, amber_pct: 8 });
    expect(m).toBeGreaterThan(0.33); // inside the "cloudy / peak" label window
    expect(m).toBeLessThan(0.7);
  });

  it("hits the ramp ends for all-clear and all-amber", () => {
    expect(maturityFromTelemetry({ clear_pct: 100, cloudy_pct: 0, amber_pct: 0 })).toBe(0);
    expect(maturityFromTelemetry({ clear_pct: 0, cloudy_pct: 0, amber_pct: 100 })).toBe(1);
    expect(maturityFromTelemetry({ clear_pct: 0, cloudy_pct: 100, amber_pct: 0 })).toBe(0.5);
  });

  it("never divides by zero on empty telemetry", () => {
    expect(maturityFromTelemetry({ clear_pct: 0, cloudy_pct: 0, amber_pct: 0 })).toBe(0);
  });
});
