import { describe, expect, it } from "vitest";
import { colaTops } from "../apicalDominance";

describe("colaTops", () => {
  it("high apical dominance → a single dominant leader cola (legacy behaviour)", () => {
    const t = colaTops(1);
    expect(t.count).toBe(1);
    expect(t.leaderShare).toBe(1);
    expect(t.secondaryShares).toEqual([]);
    expect(t.release).toBeLessThan(0.1);
  });

  it("low apical dominance → several co-dominant tops", () => {
    const t = colaTops(0);
    expect(t.count).toBeGreaterThan(1);
    expect(t.count).toBeLessThanOrEqual(4);
    expect(t.secondaryShares).toHaveLength(t.count - 1);
    expect(t.release).toBeGreaterThan(0.7);
  });

  it("fewer tops as dominance rises (monotonic, non-increasing)", () => {
    let prev = colaTops(0).count;
    for (const dom of [0.2, 0.4, 0.6, 0.8, 1]) {
      const c = colaTops(dom).count;
      expect(c).toBeLessThanOrEqual(prev);
      prev = c;
    }
  });

  it("conserves total flower mass (leader + secondaries sum to 1)", () => {
    for (const dom of [0, 0.25, 0.5, 0.75, 1]) {
      const t = colaTops(dom);
      const total = t.leaderShare + t.secondaryShares.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("keeps the leader the biggest cola even in a multi-top canopy", () => {
    const t = colaTops(0.3);
    expect(t.count).toBeGreaterThan(1);
    for (const s of t.secondaryShares) {
      expect(t.leaderShare).toBeGreaterThanOrEqual(s);
    }
  });

  it("clamps out-of-range input and is deterministic", () => {
    expect(colaTops(-1)).toEqual(colaTops(0));
    expect(colaTops(2)).toEqual(colaTops(1));
    expect(colaTops(0.42)).toEqual(colaTops(0.42));
  });
});
