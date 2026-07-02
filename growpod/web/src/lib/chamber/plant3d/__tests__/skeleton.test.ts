import { describe, it, expect } from "vitest";
import { buildPlantSkeleton } from "@/lib/chamber/plant3d/skeleton";
import { morphologyFor, type DevParams } from "@/lib/chamber/morphology";
import { silhouetteFor } from "@/lib/chamber/strainVisuals";

const morph = morphologyFor(0.5);
const sil = silhouetteFor("blue-dream", 0.5);
const flowerDev: DevParams = { budDev: 0.8, ripe: 0.3, brown: 0.1, trich: 0.5, blush: 0.1 };
const vegDev: DevParams = { budDev: 0, ripe: 0, brown: 0, trich: 0, blush: 0 };

describe("buildPlantSkeleton", () => {
  it("is deterministic for a given seed", () => {
    const a = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const b = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    expect(a.stem).toEqual(b.stem);
    expect(a.nodes.length).toBe(b.nodes.length);
    expect(a.topCola).toEqual(b.topCola);
  });

  it("grows a taller stem as day increases", () => {
    const early = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: vegDev, day: 5, stage: "seedling" });
    const late = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    expect(late.height).toBeGreaterThan(early.height);
  });

  it("produces stem points in ascending Y order", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    for (let i = 1; i < sk.stem.length; i++) {
      expect(sk.stem[i].pos[1]).toBeGreaterThanOrEqual(sk.stem[i - 1].pos[1]);
    }
  });

  it("has a top cola in flowering stage", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    expect(sk.topCola).not.toBeNull();
    expect(sk.topCola!.scale).toBeGreaterThan(0);
  });

  it("has no top cola in vegetative stage", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: vegDev, day: 25, stage: "vegetative" });
    expect(sk.topCola).toBeNull();
  });

  it("produces nodes with branches", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    expect(sk.nodes.length).toBeGreaterThan(2);
    for (const node of sk.nodes) {
      expect(node.branch.points.length).toBeGreaterThan(1);
      expect(node.branch.radii.length).toBeGreaterThan(1);
    }
  });

  it("places fan leaves at nodes", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const totalLeaves = sk.nodes.reduce((n, nd) => n + nd.fanLeaves.length, 0);
    expect(totalLeaves).toBeGreaterThan(5);
  });

  it("places bud sites at upper nodes during flowering", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const buds = sk.nodes.filter(n => n.budSite);
    expect(buds.length).toBeGreaterThan(0);
  });

  it("produces different plants for different seeds", () => {
    const a = buildPlantSkeleton({ seed: 1, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const b = buildPlantSkeleton({ seed: 2, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const aFirstNode = a.nodes[0]?.pos;
    const bFirstNode = b.nodes[0]?.pos;
    expect(aFirstNode).not.toEqual(bFirstNode);
  });

  it("respects strain silhouette differences", () => {
    const spear = buildPlantSkeleton({ seed: 42, morph, silhouette: silhouetteFor("g13", 0.3), dev: flowerDev, day: 50, stage: "flowering" });
    const bush = buildPlantSkeleton({ seed: 42, morph, silhouette: silhouetteFor("purple-diddy-punch", 0.8), dev: flowerDev, day: 50, stage: "flowering" });
    // Different silhouettes should produce different node counts or layouts.
    expect(spear.nodes.length).not.toBe(bush.nodes.length);
  });

  it("stem radius tapers from base to apex", () => {
    const sk = buildPlantSkeleton({ seed: 42, morph, silhouette: sil, dev: flowerDev, day: 50, stage: "flowering" });
    const baseR = sk.stem[0].radius;
    const tipR = sk.stem[sk.stem.length - 1].radius;
    expect(baseR).toBeGreaterThan(tipR);
  });
});
