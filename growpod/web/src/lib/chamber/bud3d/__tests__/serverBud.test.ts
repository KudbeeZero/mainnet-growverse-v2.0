import { describe, it, expect } from "vitest";
import { budParamsFromTrichomes } from "@/lib/chamber/bud3d/serverBud";
import type { TrichomeTelemetry } from "@/lib/types";

const T = (over: Partial<TrichomeTelemetry> = {}): TrichomeTelemetry => ({
  active: true, density: 0.6, head_development: 0.5,
  clear_pct: 40, cloudy_pct: 52, amber_pct: 8,
  dominant: "cloudy", harvest_window: "peak", recommendation: "", ...over,
});

describe("budParamsFromTrichomes", () => {
  it("maps cloudy+amber → ripe and density → trich when live + active", () => {
    const r = budParamsFromTrichomes(T(), false)!;
    expect(r.ripe).toBeCloseTo(0.6); // (52 + 8) / 100
    expect(r.trich).toBeCloseTo(0.6);
  });

  it("returns null while previewing (fall back to client dev.*)", () => {
    expect(budParamsFromTrichomes(T(), true)).toBeNull();
  });

  it("returns null when telemetry is missing or inactive", () => {
    expect(budParamsFromTrichomes(undefined, false)).toBeNull();
    expect(budParamsFromTrichomes(T({ active: false }), false)).toBeNull();
  });

  it("clamps to 0..1", () => {
    const r = budParamsFromTrichomes(T({ density: 1.5, cloudy_pct: 90, amber_pct: 40 }), false)!;
    expect(r.trich).toBe(1);
    expect(r.ripe).toBe(1);
  });

  it("ripens as amber climbs", () => {
    const early = budParamsFromTrichomes(T({ clear_pct: 80, cloudy_pct: 18, amber_pct: 2 }), false)!;
    const late = budParamsFromTrichomes(T({ clear_pct: 20, cloudy_pct: 50, amber_pct: 30 }), false)!;
    expect(late.ripe).toBeGreaterThan(early.ripe);
  });
});
