import { describe, expect, it } from "vitest";
import {
  CALYX_FOXTAIL,
  CALYX_OVAL,
  CALYX_POINTED,
  CALYX_TEARDROP,
  calyxShapeFor,
} from "@/lib/chamber/calyxShape";

describe("calyxShapeFor", () => {
  const ovalCut = 0.7;
  const foxCut = 0.85;

  it("maps each band to the right shape", () => {
    expect(calyxShapeFor(0.0, ovalCut, foxCut)).toBe(CALYX_TEARDROP);
    expect(calyxShapeFor(0.51, ovalCut, foxCut)).toBe(CALYX_TEARDROP);
    expect(calyxShapeFor(0.6, ovalCut, foxCut)).toBe(CALYX_OVAL);
    expect(calyxShapeFor(0.8, ovalCut, foxCut)).toBe(CALYX_POINTED);
    expect(calyxShapeFor(0.95, ovalCut, foxCut)).toBe(CALYX_FOXTAIL);
  });

  it("makes teardrops the plurality and keeps ovals a thin band", () => {
    const counts = [0, 0, 0, 0];
    const N = 1000;
    for (let i = 0; i < N; i++) counts[calyxShapeFor(i / N, ovalCut, foxCut)]++;
    // teardrops dominate
    expect(counts[CALYX_TEARDROP]).toBeGreaterThan(counts[CALYX_OVAL]);
    expect(counts[CALYX_TEARDROP]).toBeGreaterThan(counts[CALYX_POINTED]);
    // ovals are a thin slice (~18%), not the grape-cluster majority
    expect(counts[CALYX_OVAL] / N).toBeLessThan(0.22);
  });
});
