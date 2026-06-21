import { describe, it, expect, afterEach } from "vitest";
import {
  startDemo,
  strainForSlug,
  DEMO_STRAINS,
  DEMO_STORAGE,
  DEMO_VERSION,
  loadDemo,
} from "@/lib/demoStore";

type FakeLS = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

function stubLocalStorage(): FakeLS {
  const map = new Map<string, string>();
  const ls: FakeLS = {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  (globalThis as { window?: { localStorage: FakeLS } }).window = { localStorage: ls };
  return ls;
}

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

describe("loadDemo version gate", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("evicts a legacy grow (the pre-picker 'original' plant) and returns null", () => {
    const ls = stubLocalStorage();
    // A grow saved before versioning existed — no `version` field.
    ls.setItem(
      DEMO_STORAGE,
      JSON.stringify({ strainName: "Original Fixed Plant", stage: "flowering", day: 30 }),
    );
    expect(loadDemo()).toBeNull();
    expect(ls.getItem(DEMO_STORAGE)).toBeNull(); // evicted, not just ignored
  });

  it("evicts an older-version grow (e.g. a v1 plant before the bump) and returns null", () => {
    const ls = stubLocalStorage();
    // The exact case the owner hit: a plant saved under an earlier schema
    // version that must not reappear after DEMO_VERSION was bumped.
    ls.setItem(
      DEMO_STORAGE,
      JSON.stringify({ version: DEMO_VERSION - 1, strainName: "Stale Plant", stage: "vegetative", day: 12 }),
    );
    expect(loadDemo()).toBeNull();
    expect(ls.getItem(DEMO_STORAGE)).toBeNull(); // evicted, not just ignored
  });

  it("keeps a current-version grow", () => {
    const ls = stubLocalStorage();
    ls.setItem(DEMO_STORAGE, JSON.stringify(startDemo("Tester", "g13")));
    expect(loadDemo()?.strainSlug).toBe("g13");
  });
});
