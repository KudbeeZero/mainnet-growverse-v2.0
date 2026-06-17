import { describe, it, expect } from "vitest";
import { genomeGraph, lineageGraph, genbankGraph } from "@/components/viz/graphAdapters";
import { RARITY_HEX } from "@/lib/format";
import type { Strain, Lineage, LineageNode, Rarity } from "@/lib/types";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function makeStrain(overrides: Partial<Strain> = {}): Strain {
  return {
    id: "s1",
    name: "Test Strain",
    slug: "test-strain",
    lineage_type: "hybrid",
    rarity: "common",
    indica_ratio: 0.5,
    thc_range: [15, 20],
    cbd_range: [0, 1],
    flowering_days: [55, 65],
    yield_range: [400, 500],
    difficulty: 2,
    terpenes: null,
    stability: 0.8,
    generation: 0,
    parent_a_id: null,
    parent_b_id: null,
    is_base_catalog: true,
    genome: null,
    nft_asset_id: null,
    nft_status: "none",
    ...overrides,
  };
}

function makeLineageNode(overrides: Partial<LineageNode> = {}): LineageNode {
  return {
    strain_id: "n1",
    name: "Node",
    generation: 0,
    rarity: "common",
    ...overrides,
  };
}

describe("genomeGraph", () => {
  it("creates only the center node when genome is null", () => {
    const { nodes, edges } = genomeGraph(makeStrain({ genome: null }));
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it("pins the center node at fx/fy = 0 and marks it a hub", () => {
    const { nodes } = genomeGraph(makeStrain({ name: "Center", rarity: "rare" }));
    const center = nodes.find((n) => n.id === "__center")!;
    expect(center).toBeDefined();
    expect(center.fx).toBe(0);
    expect(center.fy).toBe(0);
    expect(center.hub).toBe(true);
    expect(center.label).toBe("Center");
    expect(center.color).toBe(RARITY_HEX.rare);
    expect(center.weight).toBe(1);
  });

  it("creates one node + one edge per locus, all connected to center", () => {
    const strain = makeStrain({
      genome: {
        potency: { value: 0.8, dominance: "AA" },
        aroma: { value: 0.3, dominance: "aa" },
      },
    });
    const { nodes, edges } = genomeGraph(strain);
    // center + 2 loci
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    for (const e of edges) {
      expect(e.a).toBe("__center");
      expect(["potency", "aroma"]).toContain(e.b);
    }
  });

  it("makes expressed traits (value >= 0.6) luminous hubs and others not", () => {
    const strain = makeStrain({
      genome: {
        potency: { value: 0.6, dominance: "AA" }, // exactly at threshold -> expressed
        aroma: { value: 0.59, dominance: "aa" }, // just below -> not expressed
      },
    });
    const { nodes } = genomeGraph(strain);
    const potency = nodes.find((n) => n.id === "potency")!;
    const aroma = nodes.find((n) => n.id === "aroma")!;
    expect(potency.hub).toBe(true);
    expect(potency.color).toBe("#a78bfa");
    expect(aroma.hub).toBe(false);
    expect(aroma.color).toBe("#76c024");
  });

  it("defaults a missing/non-numeric gene value to 0.5 (not expressed)", () => {
    const strain = makeStrain({
      // value missing on purpose -> falls back to 0.5
      genome: { mystery: { dominance: "Aa" } as unknown as { value: number; dominance: string } },
    });
    const { nodes } = genomeGraph(strain);
    const node = nodes.find((n) => n.id === "mystery")!;
    expect(node.hub).toBe(false);
    expect(node.label).toContain("50%");
    expect(node.weight).toBe(0.5);
  });

  it("clamps node weight into [0.15, 1]", () => {
    const strain = makeStrain({
      genome: {
        low: { value: 0.05, dominance: "aa" },
        high: { value: 1.5, dominance: "AA" },
      },
    });
    const { nodes } = genomeGraph(strain);
    expect(nodes.find((n) => n.id === "low")!.weight).toBe(0.15);
    expect(nodes.find((n) => n.id === "high")!.weight).toBe(1);
  });

  it("uses valid 6-digit hex colors for all nodes", () => {
    const strain = makeStrain({
      rarity: "legendary",
      genome: {
        a: { value: 0.9, dominance: "AA" },
        b: { value: 0.2, dominance: "aa" },
      },
    });
    const { nodes } = genomeGraph(strain);
    for (const n of nodes) {
      expect(n.color).toMatch(HEX6);
    }
  });

  it("scales edge strength with value (0.6 + value*0.4)", () => {
    const strain = makeStrain({ genome: { x: { value: 1, dominance: "AA" } } });
    const { edges } = genomeGraph(strain);
    expect(edges[0].strength).toBeCloseTo(1.0, 5);
  });
});

describe("lineageGraph", () => {
  function makeLineage(nodes: LineageNode[], overrides: Partial<Lineage> = {}): Lineage {
    return {
      strain_id: nodes[0]?.strain_id ?? "root",
      fully_verified: false,
      node_count: nodes.length,
      root_count: nodes.filter((n) => n.root).length,
      truncated: false,
      lineage: nodes,
      ...overrides,
    };
  }

  it("produces one node per lineage entry", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "a" }),
      makeLineageNode({ strain_id: "b" }),
    ]);
    const { nodes } = lineageGraph(lineage, "a");
    expect(nodes).toHaveLength(2);
  });

  it("pins only the root/queried node at fx/fy = 0", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "a" }),
      makeLineageNode({ strain_id: "b" }),
    ]);
    const { nodes } = lineageGraph(lineage, "a");
    const a = nodes.find((n) => n.id === "a")!;
    const b = nodes.find((n) => n.id === "b")!;
    expect(a.fx).toBe(0);
    expect(a.fy).toBe(0);
    expect(b.fx).toBeUndefined();
    expect(b.fy).toBeUndefined();
  });

  it("marks the queried node and any root nodes as hubs", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "a" }),
      makeLineageNode({ strain_id: "b", root: true }),
      makeLineageNode({ strain_id: "c" }),
    ]);
    const { nodes } = lineageGraph(lineage, "a");
    expect(nodes.find((n) => n.id === "a")!.hub).toBe(true); // queried
    expect(nodes.find((n) => n.id === "b")!.hub).toBe(true); // root
    expect(nodes.find((n) => n.id === "c")!.hub).toBe(false);
  });

  it("only adds edges between ids present in the lineage set", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "parent" }),
      makeLineageNode({
        strain_id: "child",
        parent_a_id: "parent",
        parent_b_id: "missing", // not in set -> no edge
      }),
    ]);
    const { edges } = lineageGraph(lineage, "child");
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({ a: "parent", b: "child" });
  });

  it("adds two edges when both parents are in the set", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "pa" }),
      makeLineageNode({ strain_id: "pb" }),
      makeLineageNode({ strain_id: "kid", parent_a_id: "pa", parent_b_id: "pb" }),
    ]);
    const { edges } = lineageGraph(lineage, "kid");
    expect(edges).toHaveLength(2);
    expect(edges).toContainEqual({ a: "pa", b: "kid" });
    expect(edges).toContainEqual({ a: "pb", b: "kid" });
  });

  it("falls back to gray for an unknown rarity but uses RARITY_HEX otherwise", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "a", rarity: "epic" }),
      makeLineageNode({ strain_id: "b", rarity: "bogus" as unknown as Rarity }),
    ]);
    const { nodes } = lineageGraph(lineage, "a");
    expect(nodes.find((n) => n.id === "a")!.color).toBe(RARITY_HEX.epic);
    expect(nodes.find((n) => n.id === "b")!.color).toBe("#9ca3af");
    for (const n of nodes) expect(n.color).toMatch(HEX6);
  });

  it("decorates labels with verification/root markers", () => {
    const lineage = makeLineage([
      makeLineageNode({ strain_id: "a", name: "Root", root: true }),
      makeLineageNode({ strain_id: "b", name: "Verified", verified: true }),
      makeLineageNode({ strain_id: "c", name: "Unverified", verified: false }),
    ]);
    const { nodes } = lineageGraph(lineage, "a");
    expect(nodes.find((n) => n.id === "a")!.label).toContain("◌");
    expect(nodes.find((n) => n.id === "b")!.label).toContain("✓");
    expect(nodes.find((n) => n.id === "c")!.label).toContain("✕");
  });

  it("returns empty nodes/edges for an empty lineage", () => {
    const lineage = makeLineage([]);
    const { nodes, edges } = lineageGraph(lineage, "none");
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});

describe("genbankGraph", () => {
  it("respects the limit by slicing strains", () => {
    const strains = Array.from({ length: 10 }, (_, i) =>
      makeStrain({ id: `s${i}`, name: `S${i}` }),
    );
    const { nodes } = genbankGraph(strains, 4);
    expect(nodes).toHaveLength(4);
    expect(nodes.map((n) => n.id)).toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("defaults the limit to 140", () => {
    const strains = Array.from({ length: 200 }, (_, i) => makeStrain({ id: `s${i}` }));
    const { nodes } = genbankGraph(strains);
    expect(nodes).toHaveLength(140);
  });

  it("only adds edges for parents present in the sliced set", () => {
    const strains = [
      makeStrain({ id: "p" }),
      makeStrain({ id: "child", parent_a_id: "p", parent_b_id: "outsider" }),
      // outsider is excluded by the limit
      makeStrain({ id: "outsider" }),
    ];
    const { edges } = genbankGraph(strains, 2);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({ a: "p", b: "child" });
  });

  it("does not add an edge when a parent is out of the sliced set", () => {
    const strains = [
      makeStrain({ id: "child", parent_a_id: "ghost", parent_b_id: null }),
    ];
    const { edges } = genbankGraph(strains);
    expect(edges).toHaveLength(0);
  });

  it("marks legendary and epic strains as hubs, others not", () => {
    const strains = [
      makeStrain({ id: "leg", rarity: "legendary" }),
      makeStrain({ id: "epi", rarity: "epic" }),
      makeStrain({ id: "com", rarity: "common" }),
    ];
    const { nodes } = genbankGraph(strains);
    expect(nodes.find((n) => n.id === "leg")!.hub).toBe(true);
    expect(nodes.find((n) => n.id === "epi")!.hub).toBe(true);
    expect(nodes.find((n) => n.id === "com")!.hub).toBe(false);
  });

  it("scales weight with generation, clamped to a 0.9 ceiling", () => {
    const gen0 = genbankGraph([makeStrain({ id: "g0", generation: 0 })]).nodes[0];
    const gen3 = genbankGraph([makeStrain({ id: "g3", generation: 3 })]).nodes[0];
    const genHuge = genbankGraph([makeStrain({ id: "gh", generation: 100 })]).nodes[0];
    expect(gen0.weight).toBeCloseTo(0.3, 5);
    expect(gen3.weight).toBeCloseTo(0.6, 5);
    expect(genHuge.weight).toBeCloseTo(0.9, 5); // 0.3 + min(0.6, ...)
  });

  it("uses valid 6-digit hex colors and falls back to gray for unknown rarity", () => {
    const strains = [
      makeStrain({ id: "a", rarity: "uncommon" }),
      makeStrain({ id: "b", rarity: "weird" as unknown as Rarity }),
    ];
    const { nodes } = genbankGraph(strains);
    expect(nodes.find((n) => n.id === "a")!.color).toBe(RARITY_HEX.uncommon);
    expect(nodes.find((n) => n.id === "b")!.color).toBe("#9ca3af");
    for (const n of nodes) expect(n.color).toMatch(HEX6);
  });

  it("returns empty graph for empty input", () => {
    const { nodes, edges } = genbankGraph([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
