import { describe, it, expect } from "vitest";
import {
  buildExplorerInstances,
  drawCallCount,
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
});
