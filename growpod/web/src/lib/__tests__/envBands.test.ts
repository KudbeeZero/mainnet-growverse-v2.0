import { describe, expect, it } from "vitest";
import {
  BANDS,
  ENV_GROUP_ORDER,
  ENV_ROWS,
  bandPct,
  bandSeverity,
  optimalMidpoint,
  optimalSpanPct,
} from "@/lib/envBands";

describe("envBands geometry", () => {
  it("bandPct clamps to the device range", () => {
    expect(bandPct(10, BANDS.temperature)).toBe(0); // range 10–40
    expect(bandPct(40, BANDS.temperature)).toBe(100);
    expect(bandPct(25, BANDS.temperature)).toBeCloseTo(50, 5);
    expect(bandPct(-100, BANDS.temperature)).toBe(0);
  });

  it("optimalSpanPct frames the optimal window inside the range", () => {
    // temperature optimal 20–28 within range 10–40 → 33.33%–60%
    const span = optimalSpanPct(BANDS.temperature);
    expect(span.left).toBeCloseTo(33.33, 1);
    expect(span.right).toBeCloseTo(60, 1);
    expect(span.left).toBeLessThan(span.right);
  });

  it("optimalMidpoint snaps to step, clamps to range, and is in band", () => {
    expect(optimalMidpoint(BANDS.temperature, 0.1)).toBe(24); // mid of 20–28
    expect(optimalMidpoint(BANDS.ph_level, 0.05)).toBe(6.5); // mid of 6–7, no float dust
    const mid = optimalMidpoint(BANDS.co2_level, 5);
    expect(bandSeverity(mid, BANDS.co2_level)).toBe(0);
  });

  it("every env row belongs to a known group, and no group is empty", () => {
    for (const row of ENV_ROWS) {
      expect(ENV_GROUP_ORDER, row.key).toContain(row.group);
    }
    for (const group of ENV_GROUP_ORDER) {
      expect(ENV_ROWS.some((r) => r.group === group), group).toBe(true);
    }
  });
});
