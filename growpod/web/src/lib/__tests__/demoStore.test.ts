import { describe, it, expect } from "vitest";
import { startDemo, strainForSlug, DEMO_STRAINS } from "@/lib/demoStore";

describe("DEMO_STRAINS", () => {
  it("offers several strains with unique slugs", () => {
    const slugs = DEMO_STRAINS.map((s) => s.slug);
    expect(slugs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("strainForSlug", () => {
  it("returns the matching strain", () => {
    expect(strainForSlug("g13").name).toBe("G13");
  });
  it("falls back to the first strain for unknown/undefined", () => {
    expect(strainForSlug("does-not-exist")).toBe(DEMO_STRAINS[0]);
    expect(strainForSlug(undefined)).toBe(DEMO_STRAINS[0]);
  });
});

describe("startDemo", () => {
  it("starts a grow with the chosen strain", () => {
    const g = startDemo("Tester", "gelato");
    expect(g.strainName).toBe("Gelato");
    expect(g.strainSlug).toBe("gelato");
    expect(g.growerName).toBe("Tester");
    expect(g.stage).toBe("seed");
    expect(g.day).toBe(1);
  });
  it("defaults the strain + name when none given", () => {
    const g = startDemo("");
    expect(g.strainSlug).toBe(DEMO_STRAINS[0].slug);
    expect(g.growerName).toBe("Demo Grower");
  });
});
