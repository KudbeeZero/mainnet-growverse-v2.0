// Unit contracts for the hover-card content builders — the pure mapping from a
// hovered constellation node id to the rich pop-up data. These guarantee the
// "more info" the owner asked for is actually surfaced (dominance genotype,
// expression %, expressed flag, center→cultivar, pedigree verification) and that
// every code path resolves the same node-id conventions graphAdapters emits.

import { describe, it, expect } from "vitest";
import {
  genomeHoverContent,
  strainHoverContent,
  lineageHoverContent,
} from "@/components/viz/GeneHoverCard";
import { RARITY_HEX } from "@/lib/format";
import type { Strain, LineageNode, Rarity } from "@/lib/types";

function makeStrain(overrides: Partial<Strain> = {}): Strain {
  return {
    id: "s1",
    name: "Test Strain",
    slug: "test-strain",
    lineage_type: "bred",
    rarity: "epic",
    indica_ratio: 0.5,
    thc_range: [18, 24],
    cbd_range: [0, 1],
    flowering_days: [55, 65],
    yield_range: [400, 500],
    difficulty: 2,
    terpenes: ["myrcene", "limonene"],
    stability: 0.8,
    generation: 3,
    parent_a_id: null,
    parent_b_id: null,
    is_base_catalog: false,
    genome: null,
    bud_dna: null,
    nft_asset_id: null,
    nft_status: "none",
    ...overrides,
  };
}

describe("genomeHoverContent", () => {
  it("resolves the __center id to the whole cultivar", () => {
    const c = genomeHoverContent(makeStrain(), "__center");
    expect(c?.kind).toBe("strain");
    if (c?.kind === "strain") {
      expect(c.name).toBe("Test Strain");
      expect(c.generation).toBe(3);
      expect(c.thc).toEqual([18, 24]);
    }
  });

  it("surfaces the dominance genotype and expression for an expressed locus", () => {
    const strain = makeStrain({
      genome: { potency: { value: 0.82, dominance: "AA" } },
    });
    const c = genomeHoverContent(strain, "potency");
    expect(c?.kind).toBe("locus");
    if (c?.kind === "locus") {
      expect(c.trait).toBe("potency");
      expect(c.valuePct).toBeCloseTo(82, 5);
      expect(c.dominance).toBe("AA"); // the never-before-shown genotype
      expect(c.expressed).toBe(true);
      expect(c.color).toBe("#a78bfa"); // expressed violet
    }
  });

  it("marks a below-threshold locus recessive and green", () => {
    const strain = makeStrain({ genome: { aroma: { value: 0.4, dominance: "aa" } } });
    const c = genomeHoverContent(strain, "aroma");
    if (c?.kind === "locus") {
      expect(c.expressed).toBe(false);
      expect(c.color).toBe("#76c024");
      expect(c.dominance).toBe("aa");
    } else {
      throw new Error("expected a locus");
    }
  });

  it("defaults a non-numeric gene value to 50% (not expressed)", () => {
    const strain = makeStrain({
      genome: { mystery: { dominance: "Aa" } as unknown as { value: number; dominance: string } },
    });
    const c = genomeHoverContent(strain, "mystery");
    if (c?.kind === "locus") {
      expect(c.valuePct).toBe(50);
      expect(c.expressed).toBe(false);
    } else {
      throw new Error("expected a locus");
    }
  });

  it("returns null for an unknown locus id", () => {
    expect(genomeHoverContent(makeStrain({ genome: {} }), "ghost")).toBeNull();
  });
});

describe("strainHoverContent", () => {
  it("tints by rarity and carries the full stat block", () => {
    const c = strainHoverContent(makeStrain({ rarity: "legendary" }));
    expect(c.color).toBe(RARITY_HEX.legendary);
    expect(c.yieldRange).toEqual([400, 500]);
    expect(c.flowering).toEqual([55, 65]);
    expect(c.stability).toBe(0.8);
    expect(c.terpenes).toEqual(["myrcene", "limonene"]);
  });
});

describe("lineageHoverContent", () => {
  function makeNode(overrides: Partial<LineageNode> = {}): LineageNode {
    return { strain_id: "n1", name: "Node", generation: 1, rarity: "rare", ...overrides };
  }

  it("carries verification, root flag and rng seed", () => {
    const c = lineageHoverContent(makeNode({ verified: true, rng_seed: 12345 }));
    expect(c.kind).toBe("lineage");
    expect(c.color).toBe(RARITY_HEX.rare);
    expect(c.verified).toBe(true);
    expect(c.rngSeed).toBe(12345);
  });

  it("falls back to gray for an unknown rarity", () => {
    const c = lineageHoverContent(makeNode({ rarity: "bogus" as unknown as Rarity }));
    expect(c.color).toBe("#9ca3af");
  });
});
