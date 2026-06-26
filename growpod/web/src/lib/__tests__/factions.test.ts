import { describe, it, expect } from "vitest";
import { factionShares } from "@/lib/factions";
import type { WaitlistStandings } from "@/lib/types";

const IDS = ["indica", "sativa", "hybrid"];

describe("factionShares", () => {
  it("computes integer percentages per faction", () => {
    const s: WaitlistStandings = { factions: { indica: 5, sativa: 3, hybrid: 2 }, total: 10 };
    expect(factionShares(s, IDS)).toEqual({ indica: 50, sativa: 30, hybrid: 20 });
  });
  it("zero-fills missing factions and handles an empty board", () => {
    expect(factionShares({ factions: { indica: 1 }, total: 1 }, IDS)).toEqual({
      indica: 100,
      sativa: 0,
      hybrid: 0,
    });
    expect(factionShares({ factions: {}, total: 0 }, IDS)).toEqual({
      indica: 0,
      sativa: 0,
      hybrid: 0,
    });
  });
  it("is safe when standings are undefined (loading)", () => {
    expect(factionShares(undefined, IDS)).toEqual({ indica: 0, sativa: 0, hybrid: 0 });
  });
});
