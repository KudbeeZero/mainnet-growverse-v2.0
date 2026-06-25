import { describe, it, expect } from "vitest";
import {
  buildExplorerInstances,
  drawCallCount,
  tierForDistance,
  TIERS,
  TIER_INFO,
  EXPLORER_PRESETS,
  DEFAULT_PARAMS,
  ANATOMY_PARTS,
  PART_LABELS,
} from "@/lib/chamber3d/explorer/parts";
import { budDnaFor } from "@/lib/chamber/budDna";
import { budColorFor } from "@/lib/chamber/morphology";

const dna = (seed = 1234) => budDnaFor(undefined, budColorFor(seed, 0.28));

describe("explorer parts", () => {
  it("is deterministic: same dna+seed+params → identical instances", () => {
    const d = dna();
    const a = buildExplorerInstances(d, 7, DEFAULT_PARAMS);
    const b = buildExplorerInstances(d, 7, DEFAULT_PARAMS);
    expect(a).toEqual(b);
  });

  it("different seeds → different colas (genetics actually drive geometry)", () => {
    const d = dna();
    const a = buildExplorerInstances(d, 1, DEFAULT_PARAMS);
    const b = buildExplorerInstances(d, 2, DEFAULT_PARAMS);
    expect(a.cola).not.toEqual(b.cola);
  });

  it("builds a non-empty cola spiral", () => {
    const inst = buildExplorerInstances(dna(), 7, DEFAULT_PARAMS);
    expect(inst.cola.length).toBeGreaterThan(0);
  });

  it("draw-call budget is bounded by the part count and well under 50", () => {
    // However many thousands of glands, the renderer is one InstancedMesh per
    // group — so the whole bud is at most ANATOMY_PARTS.length draw calls.
    const inst = buildExplorerInstances(dna(), 7, { ...DEFAULT_PARAMS, trich: 1 });
    expect(drawCallCount(inst)).toBeLessThanOrEqual(ANATOMY_PARTS.length);
    expect(drawCallCount(inst)).toBeLessThan(50);
  });

  it("ripeness param changes the frost/pistil detail (params flow through)", () => {
    const d = dna();
    const young = buildExplorerInstances(d, 7, { ...DEFAULT_PARAMS, ripe: 0 });
    const ripe = buildExplorerInstances(d, 7, { ...DEFAULT_PARAMS, ripe: 1 });
    expect(ripe).not.toEqual(young);
  });

  it("every anatomy part carries a teaching label", () => {
    for (const part of ANATOMY_PARTS) {
      expect(PART_LABELS[part].title).toBeTruthy();
      expect(PART_LABELS[part].blurb.length).toBeGreaterThan(10);
    }
  });

  it("tierForDistance is monotonic outer→inner across the zoom range", () => {
    expect(tierForDistance(3.2)).toBe("whole"); // max zoom-out
    expect(tierForDistance(2.4)).toBe("whole");
    expect(tierForDistance(2.0)).toBe("cola");
    expect(tierForDistance(1.6)).toBe("cola");
    expect(tierForDistance(1.2)).toBe("detail");
    expect(tierForDistance(1.0)).toBe("detail");
    expect(tierForDistance(0.8)).toBe("trichome");
    expect(tierForDistance(0.6)).toBe("trichome"); // max zoom-in (A1 §9: zoom to T4)
  });

  it("the tier order never inverts as the camera pulls in", () => {
    const order = TIERS.indexOf.bind(TIERS);
    const samples = [3.2, 2.4, 2.0, 1.6, 1.2, 1.0, 0.8, 0.6];
    for (let i = 1; i < samples.length; i++) {
      // closer distance ⇒ same-or-deeper tier (index never decreases)
      expect(order(tierForDistance(samples[i]))).toBeGreaterThanOrEqual(
        order(tierForDistance(samples[i - 1])),
      );
    }
  });

  it("every tier has copy and a focus part drawn from the anatomy set", () => {
    for (const tier of TIERS) {
      const info = TIER_INFO[tier];
      expect(info.title).toBeTruthy();
      expect(info.blurb.length).toBeGreaterThan(10);
      if (info.focus !== null) expect(ANATOMY_PARTS).toContain(info.focus);
    }
  });

  it("exposes the five canonical lab presets, each well-formed", () => {
    expect(EXPLORER_PRESETS).toHaveLength(5);
    const ids = new Set<string>();
    for (const p of EXPLORER_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(ids.has(p.id)).toBe(false); // unique ids
      ids.add(p.id);
      expect(p.label).toBeTruthy();
      expect(p.blurb.length).toBeGreaterThan(10);
      expect(TIERS).toContain(p.focusTier);
      for (const key of ["budDev", "ripe", "brown", "trich", "purple"] as const) {
        expect(p.params[key]).toBeGreaterThanOrEqual(0);
        expect(p.params[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every preset renders to a non-empty, draw-call-bounded bud", () => {
    const d = dna();
    for (const p of EXPLORER_PRESETS) {
      const inst = buildExplorerInstances(d, p.seed, p.params);
      expect(inst.cola.length).toBeGreaterThan(0);
      expect(drawCallCount(inst)).toBeLessThanOrEqual(ANATOMY_PARTS.length);
    }
  });
});
