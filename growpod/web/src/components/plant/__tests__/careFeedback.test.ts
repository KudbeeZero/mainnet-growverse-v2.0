import { describe, it, expect } from "vitest";
import { CARE_FX, buildParticles, type CareKind } from "@/components/plant/careFeedbackData";
import { haptic } from "@/lib/haptics";

const KINDS: CareKind[] = [
  "water",
  "feed",
  "treatPests",
  "treatDisease",
  "prune",
  "train",
  "boost",
  "harvest",
];

describe("CARE_FX", () => {
  it("defines every care kind with non-empty glyphs and a positive count", () => {
    for (const k of KINDS) {
      const fx = CARE_FX[k];
      expect(fx.glyphs.length).toBeGreaterThan(0);
      expect(fx.count).toBeGreaterThan(0);
      expect(fx.label.length).toBeGreaterThan(0);
    }
  });

  it("makes the harvest celebration the biggest burst", () => {
    for (const k of KINDS) {
      if (k === "harvest") continue;
      expect(CARE_FX.harvest.count).toBeGreaterThan(CARE_FX[k].count);
    }
  });
});

describe("buildParticles", () => {
  // Deterministic rng so the test doesn't depend on Math.random.
  const seq = (vals: number[]) => {
    let i = 0;
    return () => vals[i++ % vals.length];
  };

  it("emits fx.count particles at full motion, cycling the glyph set", () => {
    const parts = buildParticles("water", false, seq([0.5]));
    expect(parts).toHaveLength(CARE_FX.water.count);
    // glyphs cycle through the configured set
    expect(parts.map((p) => p.glyph)).toEqual(
      Array.from({ length: CARE_FX.water.count }, (_, i) => CARE_FX.water.glyphs[i % CARE_FX.water.glyphs.length]),
    );
  });

  it("collapses to a single drift-free particle under reduced motion", () => {
    const parts = buildParticles("harvest", true);
    expect(parts).toHaveLength(1);
    expect(parts[0].dx).toBe(0);
    expect(parts[0].delay).toBe(0);
  });

  it("spreads particles horizontally at full motion (signed dx)", () => {
    // rng below 0.5 → negative dx, above → positive
    const left = buildParticles("feed", false, seq([0]))[0];
    const right = buildParticles("feed", false, seq([1]))[0];
    expect(left.dx).toBeLessThan(0);
    expect(right.dx).toBeGreaterThan(0);
  });
});

describe("haptic", () => {
  it("no-ops safely when the Vibration API is unavailable (e.g. SSR/node)", () => {
    // navigator is undefined in the node test environment.
    expect(haptic(20)).toBe(false);
    expect(haptic([10, 20, 10])).toBe(false);
  });
});
