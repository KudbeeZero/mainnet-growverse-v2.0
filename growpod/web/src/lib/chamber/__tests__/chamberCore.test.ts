import { describe, expect, it } from "vitest";
import { clampPodLightness, clampLeafLightness } from "@/lib/chamber/chamberCore";

// Regression test for the "black blob" bug (2026-07-04): pod/leaf lightness
// is a sum of several independent darkening terms that can land in the same
// direction at once and go at or below 0, which canvas silently clips to
// solid black (0% lightness) instead of a dark shade. See chamberCore.ts's
// drawPod/drawFan for the documented worst-case combinations these guard.
describe("clampPodLightness", () => {
  it("floors worst-case stacked darkening well above black", () => {
    // Documented worst case: baseLit + dl(-3.5) + ring(-4) + tipBlend(-3) +
    // parityLit(-6) + ringLit(-3) ≈ -14 on top of a modest base — simulate a
    // deeply negative raw sum from a pathological future combination.
    expect(clampPodLightness(-100)).toBe(20);
    expect(clampPodLightness(-14)).toBe(20);
  });

  it("ceilings an overly bright sum", () => {
    expect(clampPodLightness(200)).toBe(58);
  });

  it("passes through values already in range", () => {
    expect(clampPodLightness(40)).toBe(40);
  });
});

describe("clampLeafLightness", () => {
  it("floors worst-case stacked darkening (litBias + recede + jitter) well above black", () => {
    // Documented worst case: litBias down to -21 on a teal/mature strain,
    // plus up to -14 more from recede/skirt/depth terms, plus leaflet jitter.
    expect(clampLeafLightness(-100)).toBe(10);
    expect(clampLeafLightness(-21)).toBe(10);
  });

  it("ceilings an overly bright sum", () => {
    expect(clampLeafLightness(200)).toBe(78);
  });

  it("passes through values already in range", () => {
    expect(clampLeafLightness(45)).toBe(45);
  });
});
