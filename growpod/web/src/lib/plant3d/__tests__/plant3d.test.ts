import { describe, it, expect } from "vitest";
import { buildPlantSkeleton } from "@/lib/plant3d/skeleton";
import { buildFanLeafOutlines, buildLeafPlacements } from "@/lib/plant3d/leaves";
import { buildPlantAssembly, LOD } from "@/lib/plant3d/assembly";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorForStrain, silhouetteFor } from "@/lib/chamber/strainVisuals";

const SIL = silhouetteFor("blue-dream", 0.4);
const DNA = budDnaFor("blue-dream", budColorForStrain("blue-dream", 110, 42));

describe("buildPlantSkeleton", () => {
  it("is deterministic for a given seed", () => {
    expect(buildPlantSkeleton(SIL, 42)).toEqual(buildPlantSkeleton(SIL, 42));
  });

  it("differs across seeds (organic variation)", () => {
    const a = buildPlantSkeleton(SIL, 1);
    const b = buildPlantSkeleton(SIL, 2);
    expect(a.branches[0].tip).not.toEqual(b.branches[0].tip);
  });

  it("builds a tapered stalk (base thicker than tip) spanning the plant height", () => {
    const sk = buildPlantSkeleton(SIL, 42);
    expect(sk.stem[0].radius).toBeGreaterThan(sk.stem[sk.stem.length - 1].radius);
    expect(sk.stem[sk.stem.length - 1].pos[1]).toBeCloseTo(sk.height, 5);
    expect(sk.stem[0].pos[1]).toBe(0);
  });

  it("grows an opposite pair of branches at every node", () => {
    const sk = buildPlantSkeleton(SIL, 42);
    expect(sk.branches.length).toBe(sk.nodes.length * 2);
  });

  it("holds buds up on the branch tips (tips above their origin nodes)", () => {
    const sk = buildPlantSkeleton(SIL, 42);
    for (const b of sk.branches) {
      expect(b.tip[1]).toBeGreaterThan(sk.nodes[b.originNode].pos[1]);
    }
  });

  it("respects apicalDominance: a stronger leader shortens the topmost branches", () => {
    const weak = buildPlantSkeleton({ ...SIL, apicalDominance: 0.2 }, 42);
    const strong = buildPlantSkeleton({ ...SIL, apicalDominance: 0.95 }, 42);
    const topLen = (sk: ReturnType<typeof buildPlantSkeleton>) =>
      sk.branches[sk.branches.length - 1].length;
    expect(topLen(strong)).toBeLessThan(topLen(weak));
  });

  it("makes the apex spear the tallest cola on the plant", () => {
    const sk = buildPlantSkeleton(SIL, 42);
    const maxBranchCola = Math.max(...sk.branches.map((b) => b.colaHeight));
    expect(sk.apexColaHeight).toBeGreaterThan(maxBranchCola);
  });
});

describe("buildFanLeafOutlines", () => {
  it("is deterministic and clamps leaflet count to 3..9", () => {
    expect(buildFanLeafOutlines(9, 7)).toEqual(buildFanLeafOutlines(9, 7));
    expect(buildFanLeafOutlines(20, 7).length).toBe(9);
    expect(buildFanLeafOutlines(1, 7).length).toBe(3);
  });

  it("produces closed polygons with several vertices each (serrated)", () => {
    const leaflets = buildFanLeafOutlines(7, 7);
    for (const l of leaflets) expect(l.outline.length).toBeGreaterThan(6);
  });
});

describe("buildLeafPlacements", () => {
  it("is deterministic and places one instance per skeleton leaf slot", () => {
    const sk = buildPlantSkeleton(SIL, 42);
    const a = buildLeafPlacements(sk, 42);
    const b = buildLeafPlacements(sk, 42);
    expect(a).toEqual(b);
    const slotTotal = sk.branches.reduce((n, br) => n + br.leafSlots.length, 0);
    expect(a.length).toBe(slotTotal);
  });
});

describe("buildPlantAssembly", () => {
  it("is deterministic for a given seed + LOD", () => {
    const a = buildPlantAssembly(DNA, SIL, 42, { lod: "close" });
    const b = buildPlantAssembly(DNA, SIL, 42, { lod: "close" });
    expect(a.counts).toEqual(b.counts);
  });

  it("places one cola on the apex plus one per branch tip", () => {
    const asm = buildPlantAssembly(DNA, SIL, 42, { lod: "close" });
    expect(asm.counts.colas).toBe(asm.skeleton.branches.length + 1);
  });

  it("LOD instance counts are monotonic (close >= mid >= far)", () => {
    const close = buildPlantAssembly(DNA, SIL, 42, { lod: "close" }).counts;
    const mid = buildPlantAssembly(DNA, SIL, 42, { lod: "mid" }).counts;
    const far = buildPlantAssembly(DNA, SIL, 42, { lod: "far" }).counts;
    expect(close.calyxes).toBeGreaterThanOrEqual(mid.calyxes);
    expect(mid.calyxes).toBeGreaterThanOrEqual(far.calyxes);
    expect(close.frost).toBeGreaterThanOrEqual(mid.frost);
    expect(mid.frost).toBeGreaterThanOrEqual(far.frost);
    expect(close.pistils).toBeGreaterThanOrEqual(mid.pistils);
    expect(mid.pistils).toBeGreaterThanOrEqual(far.pistils);
  });

  it("LOD multiplier caps are themselves monotonic", () => {
    expect(LOD.close.calyxCap).toBeGreaterThanOrEqual(LOD.mid.calyxCap);
    expect(LOD.mid.calyxCap).toBeGreaterThanOrEqual(LOD.far.calyxCap);
    expect(LOD.close.frost).toBeGreaterThanOrEqual(LOD.mid.frost);
    expect(LOD.mid.frost).toBeGreaterThanOrEqual(LOD.far.frost);
  });

  it("far LOD drops frost + pistils entirely (simplified silhouette)", () => {
    const far = buildPlantAssembly(DNA, SIL, 42, { lod: "far" }).counts;
    expect(far.frost).toBe(0);
    expect(far.pistils).toBe(0);
  });
});
