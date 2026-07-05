import { describe, expect, it } from "vitest";
import {
  GOLDEN_ANGLE,
  phyllotaxis,
  foreshorten,
  depthShade,
} from "../phyllotaxy";

describe("phyllotaxy — golden angle", () => {
  it("is 137.5077° in radians", () => {
    expect(GOLDEN_ANGLE).toBeCloseTo(2.399963, 5);
    expect((GOLDEN_ANGLE * 180) / Math.PI).toBeCloseTo(137.5077, 3);
  });
});

describe("phyllotaxis", () => {
  it("handles empty and singleton stacks", () => {
    expect(phyllotaxis(0, 1)).toEqual([]);
    const one = phyllotaxis(1, 1, 0);
    expect(one).toHaveLength(1);
    expect(one[0].az).toBe(0);
    expect(one[0].lateral).toBeCloseTo(1, 6);
    expect(one[0].depth).toBeCloseTo(0, 6);
  });

  it("at maturity 0 reproduces the legacy flat left/right alternation (no depth)", () => {
    const a = phyllotaxis(6, 0, 0);
    // azimuths 0, π, 2π, 3π… → lateral = +1,-1,+1,-1; depth ≈ 0 throughout.
    for (let i = 0; i < a.length; i++) {
      expect(a[i].lateral).toBeCloseTo(i % 2 === 0 ? 1 : -1, 6);
      expect(a[i].depth).toBeCloseTo(0, 6);
      expect(a[i].side).toBe(i % 2 === 0 ? 1 : -1);
    }
  });

  it("at maturity 1 winds the apex into a spiral with real front/back depth", () => {
    const a = phyllotaxis(10, 1, 0);
    // Lower nodes stay near-opposite (depth ~0); upper nodes gain depth.
    expect(Math.abs(a[0].depth)).toBeLessThan(0.2);
    const apexDepth = Math.max(...a.slice(6).map((n) => Math.abs(n.depth)));
    expect(apexDepth).toBeGreaterThan(0.3);
    // Successive apex steps are the golden angle, never a fixed 180° flip.
    const step = a[9].az - a[8].az;
    expect(step).toBeCloseTo(GOLDEN_ANGLE, 1);
  });

  it("is deterministic and phase rotates the whole pattern", () => {
    expect(phyllotaxis(8, 1, 0.7)).toEqual(phyllotaxis(8, 1, 0.7));
    const base = phyllotaxis(5, 1, 0);
    const rot = phyllotaxis(5, 1, 0.9);
    expect(rot[0].az - base[0].az).toBeCloseTo(0.9, 6);
    expect(rot[3].az - base[3].az).toBeCloseTo(0.9, 6);
  });

  it("keeps lateral/depth on the unit circle", () => {
    for (const n of phyllotaxis(14, 1, 0.3)) {
      expect(n.lateral * n.lateral + n.depth * n.depth).toBeCloseTo(1, 6);
    }
  });
});

describe("foreshorten", () => {
  it("floors a camera-facing branch and gives full length sideways", () => {
    expect(foreshorten(0)).toBeCloseTo(0.42, 6);
    expect(foreshorten(1)).toBeCloseTo(1, 6);
    expect(foreshorten(-1)).toBeCloseTo(1, 6);
  });
  it("is monotonic in |lateral|", () => {
    expect(foreshorten(0.5)).toBeGreaterThan(foreshorten(0.2));
    expect(foreshorten(-0.8)).toBeGreaterThan(foreshorten(-0.4));
  });
});

describe("depthShade", () => {
  it("brightens the front and darkens the back, bounded (default amount)", () => {
    expect(depthShade(1)).toBeCloseTo(10, 6);
    expect(depthShade(-1)).toBeCloseTo(-10, 6);
    expect(depthShade(0)).toBe(0);
    expect(depthShade(5)).toBeCloseTo(10, 6); // clamped
  });
  it("honors a custom amount", () => {
    expect(depthShade(1, 7)).toBeCloseTo(7, 6);
    expect(depthShade(-1, 7)).toBeCloseTo(-7, 6);
  });
});
